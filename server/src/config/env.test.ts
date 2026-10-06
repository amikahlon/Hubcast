import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('accepts a complete environment and defaults the port', () => {
    expect(parseEnv({ ANTHROPIC_API_KEY: 'key', ANTHROPIC_MODEL: 'model' })).toEqual({
      PORT: 3001,
      ANTHROPIC_API_KEY: 'key',
      ANTHROPIC_MODEL: 'model',
    });
    const withPort = parseEnv({ PORT: '4000', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm' });
    expect(withPort.PORT).toBe(4000);
  });

  it.each([
    ['a missing key', { ANTHROPIC_MODEL: 'model' }, 'ANTHROPIC_API_KEY'],
    ['an empty key', { ANTHROPIC_API_KEY: '', ANTHROPIC_MODEL: 'model' }, 'ANTHROPIC_API_KEY'],
    ['a missing model', { ANTHROPIC_API_KEY: 'key' }, 'ANTHROPIC_MODEL'],
    ['an empty model', { ANTHROPIC_API_KEY: 'key', ANTHROPIC_MODEL: '' }, 'ANTHROPIC_MODEL'],
  ])('rejects %s', (_label, env, name) => {
    expect(() => parseEnv(env)).toThrow(name);
  });

  it('rejects an invalid port', () => {
    const env = { PORT: 'abc', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm' };
    expect(() => parseEnv(env)).toThrow(/PORT/);
  });
});
