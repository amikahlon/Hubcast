import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ApiErrorSchema, HealthResponseSchema, HubsResponseSchema } from '@hubcast/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadHubCatalog } from './data/hubs.js';
import { createHubsService } from './services/hubs.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const hubs = await loadHubCatalog();
  const app = createApp({ hubsService: createHubsService(hubs), dataAsOf: null });
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

describe('GET /health', () => {
  it('returns status and hub count', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(HealthResponseSchema.parse(body)).toEqual({
      status: 'ok',
      hubCount: 19,
      dataAsOf: null,
    });
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

describe('unknown routes', () => {
  it('returns 404 with the ApiError shape', async () => {
    const { status, body } = await get('/nope');
    expect(status).toBe(404);
    expect(ApiErrorSchema.parse(body).error.code).toBe('NOT_FOUND');
  });
});
