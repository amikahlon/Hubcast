import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ApiErrorSchema,
  ChatResponseSchema,
  HealthResponseSchema,
  HubsResponseSchema,
} from '@hubcast/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatResult } from './agent/chat.js';
import { AgentError } from './agent/errors.js';
import { createApp } from './app.js';
import { loadDataset } from './data/dataset.js';
import { loadHubCatalog } from './data/hubs.js';
import { createHubsService } from './services/hubs.js';

let server: Server;
let baseUrl: string;
let dataAsOf: string;
/** What the chat service of the app under test does; each test sets it. */
let chatImpl: (threadId: string, message: string) => Promise<ChatResult>;

beforeAll(async () => {
  const hubs = await loadHubCatalog();
  const dataset = await loadDataset(hubs);
  dataAsOf = dataset.meta.refreshedAt;
  const app = createApp({
    hubsService: createHubsService(hubs),
    chatService: { chat: (threadId, message) => chatImpl(threadId, message) },
    dataAsOf,
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

async function post(path: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

describe('GET /health', () => {
  it('returns status, hub count and the data refresh date', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(HealthResponseSchema.parse(body)).toEqual({ status: 'ok', hubCount: 19, dataAsOf });
    expect(dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('GET /hubs', () => {
  it('lists all 19 hubs', async () => {
    const { status, body } = await get('/hubs');
    expect(status).toBe(200);
    expect(HubsResponseSchema.parse(body).hubs).toHaveLength(19);
  });

  it('filters by region', async () => {
    const { body } = await get('/hubs?region=Northeast');
    expect(HubsResponseSchema.parse(body).hubs.map((hub) => hub.id)).toEqual([
      'boston-ma',
      'newark-nj',
      'philadelphia-pa',
    ]);
  });

  it('filters by state, case-insensitively', async () => {
    const { body } = await get('/hubs?state=ca');
    expect(HubsResponseSchema.parse(body).hubs.map((hub) => hub.id)).toEqual([
      'los-angeles-ca',
      'sacramento-ca',
    ]);
  });

  it('returns an empty list for a state without hubs', async () => {
    const { status, body } = await get('/hubs?state=WY');
    expect(status).toBe(200);
    expect(HubsResponseSchema.parse(body).hubs).toEqual([]);
  });

  it.each([
    ['unknown region', '/hubs?region=Atlantis'],
    ['unknown state', '/hubs?state=ZZ'],
    ['unknown parameter', '/hubs?city=Dallas'],
    ['repeated parameter', '/hubs?region=South&region=West'],
  ])('returns 400 for %s', async (_label, path) => {
    const { status, body } = await get(path);
    expect(status).toBe(400);
    expect(ApiErrorSchema.parse(body).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /chat', () => {
  const threadId = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
  const result: ChatResult = {
    answer: 'Dallas has a high overall risk.',
    hubIds: ['dallas-tx'],
    explanation: 'Its overall score is 78.6.',
    assumptions: [],
    toolCalls: [{ name: 'get_risk_scores', ok: true }],
    sources: ['Open-Meteo'],
    dataAsOf: '2026-10-06',
  };

  it('passes threadId and message to the chat service and returns a valid ChatResponse', async () => {
    const calls: [string, string][] = [];
    chatImpl = (id, message) => {
      calls.push([id, message]);
      return Promise.resolve(result);
    };
    const { status, body } = await post('/chat', { threadId, message: '  Why is Dallas risky?  ' });
    expect(status).toBe(200);
    expect(ChatResponseSchema.parse(body)).toEqual({ threadId, ...result });
    expect(calls).toEqual([[threadId, 'Why is Dallas risky?']]);
  });

  it.each([
    ['a threadId that is not a UUID', { threadId: 'abc', message: 'Hi' }],
    ['a missing message', { threadId }],
    ['a blank message', { threadId, message: '   ' }],
    ['a message that is too long', { threadId, message: 'a'.repeat(2001) }],
    ['invalid JSON', '{not json'],
  ])('returns 400 for %s without calling the agent', async (_label, payload) => {
    let called = false;
    chatImpl = () => {
      called = true;
      return Promise.resolve(result);
    };
    const { status, body } = await post('/chat', payload);
    expect(status).toBe(400);
    expect(ApiErrorSchema.parse(body).error.code).toBe('VALIDATION_ERROR');
    expect(called).toBe(false);
  });

  it('returns 502 AGENT_ERROR when the agent fails', async () => {
    chatImpl = () => Promise.reject(new AgentError('The assistant is unavailable right now.'));
    const { status, body } = await post('/chat', { threadId, message: 'Hi' });
    expect(status).toBe(502);
    expect(ApiErrorSchema.parse(body).error).toEqual({
      code: 'AGENT_ERROR',
      message: 'The assistant is unavailable right now.',
    });
  });

  it('returns 500 INTERNAL_ERROR for an unexpected failure, without details', async () => {
    chatImpl = () => Promise.reject(new Error('secret detail'));
    const { status, body } = await post('/chat', { threadId, message: 'Hi' });
    expect(status).toBe(500);
    expect(ApiErrorSchema.parse(body).error.message).not.toContain('secret');
  });
});

describe('unknown routes', () => {
  it('returns 404 with the ApiError shape', async () => {
    const { status, body } = await get('/nope');
    expect(status).toBe(404);
    expect(ApiErrorSchema.parse(body).error.code).toBe('NOT_FOUND');
  });
});
