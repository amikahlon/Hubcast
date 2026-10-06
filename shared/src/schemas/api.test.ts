import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthResponseSchema, HubsQuerySchema } from './api.js';

describe('HubsQuerySchema', () => {
  it('accepts an empty query', () => {
    expect(HubsQuerySchema.parse({})).toEqual({});
  });

  it('accepts region and state, normalising state case', () => {
    expect(HubsQuerySchema.parse({ region: 'South', state: 'tx' })).toEqual({
      region: 'South',
      state: 'TX',
    });
  });

  it.each([
    ['unknown region', { region: 'Southwest' }],
    ['unknown state', { state: 'ZZ' }],
    ['repeated parameter', { region: ['South', 'West'] }],
    ['unknown parameter', { city: 'Dallas' }],
  ])('rejects %s', (_label, input) => {
    expect(HubsQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts a known error code', () => {
    const body = { error: { code: 'AGENT_ERROR', message: 'Claude API failed' } };
    expect(ApiErrorSchema.parse(body)).toEqual(body);
  });

  it('rejects an unknown error code', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'TEAPOT', message: 'x' } }).success).toBe(
      false,
    );
  });
});

describe('HealthResponseSchema', () => {
  it('accepts null dataAsOf', () => {
    expect(
      HealthResponseSchema.safeParse({ status: 'ok', hubCount: 19, dataAsOf: null }).success,
    ).toBe(true);
  });

  it('rejects a negative hub count', () => {
    expect(
      HealthResponseSchema.safeParse({ status: 'ok', hubCount: -1, dataAsOf: null }).success,
    ).toBe(false);
  });
});
