import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { toolResultSchema } from './tool.js';

const ResultSchema = toolResultSchema(z.object({ count: z.number() }));
const meta = { sources: ['FEMA NRI'], dataAsOf: '2026-01-15' };

describe('toolResultSchema', () => {
  it('accepts a success result', () => {
    const result = { ok: true, data: { count: 3 }, meta };
    expect(ResultSchema.parse(result)).toEqual(result);
  });

  it('accepts a failure result', () => {
    const result = { ok: false, error: { code: 'OUT_OF_RANGE', message: 'No data for 1999' } };
    expect(ResultSchema.parse(result)).toEqual(result);
  });

  it('accepts null dataAsOf', () => {
    const result = { ok: true, data: { count: 0 }, meta: { sources: [], dataAsOf: null } };
    expect(ResultSchema.safeParse(result).success).toBe(true);
  });

  it.each([
    ['data of the wrong shape', { ok: true, data: { count: 'three' }, meta }],
    ['missing meta', { ok: true, data: { count: 3 } }],
    ['invalid dataAsOf', { ok: true, data: { count: 3 }, meta: { sources: [], dataAsOf: 'soon' } }],
    ['unknown error code', { ok: false, error: { code: 'OOPS', message: 'x' } }],
    ['failure without error', { ok: false }],
  ])('rejects %s', (_label, input) => {
    expect(ResultSchema.safeParse(input).success).toBe(false);
  });
});
