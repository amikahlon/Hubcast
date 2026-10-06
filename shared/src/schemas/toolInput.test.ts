import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildToolInputSchemas } from './toolInput.js';

const schemas = buildToolInputSchemas(['miami-fl', 'houston-tx', 'denver-co']);

describe('tool input schemas', () => {
  it('list_hubs accepts no filter, a region or a state (any case)', () => {
    expect(schemas.list_hubs.parse({})).toEqual({});
    expect(schemas.list_hubs.parse({ region: 'South', state: 'tx' })).toEqual({
      region: 'South',
      state: 'TX',
    });
  });

  it('get_weather_stats accepts hub IDs with an optional year', () => {
    expect(schemas.get_weather_stats.parse({ hubIds: ['denver-co'], year: 2025 })).toEqual({
      hubIds: ['denver-co'],
      year: 2025,
    });
    const withoutYear = schemas.get_weather_stats.parse({ hubIds: ['denver-co', 'miami-fl'] });
    expect(withoutYear.year).toBeUndefined();
  });

  it('get_hazard_exposure accepts optional hazards', () => {
    expect(
      schemas.get_hazard_exposure.parse({ hubIds: ['miami-fl'], hazards: ['hurricane', 'flood'] }),
    ).toEqual({ hubIds: ['miami-fl'], hazards: ['hurricane', 'flood'] });
  });

  it('get_risk_scores accepts everything optional', () => {
    expect(schemas.get_risk_scores.parse({})).toEqual({});
    expect(schemas.get_risk_scores.parse({ hubIds: ['miami-fl'], sortBy: 'hurricane' })).toEqual({
      hubIds: ['miami-fl'],
      sortBy: 'hurricane',
    });
  });

  it.each([
    ['unknown hub ID', 'get_weather_stats', { hubIds: ['springfield-il'] }],
    ['empty hubIds', 'get_weather_stats', { hubIds: [] }],
    ['missing hubIds', 'get_hazard_exposure', { hazards: ['flood'] }],
    ['non-integer year', 'get_weather_stats', { hubIds: ['miami-fl'], year: 2024.5 }],
    ['year as text', 'get_weather_stats', { hubIds: ['miami-fl'], year: '2024' }],
    ['unknown hazard', 'get_hazard_exposure', { hubIds: ['miami-fl'], hazards: ['earthquake'] }],
    ['empty hazards', 'get_hazard_exposure', { hubIds: ['miami-fl'], hazards: [] }],
    ['unknown sortBy', 'get_risk_scores', { sortBy: 'earthquake' }],
    ['empty hubIds for scores', 'get_risk_scores', { hubIds: [] }],
    ['unknown region', 'list_hubs', { region: 'Atlantis' }],
    ['unknown state', 'list_hubs', { state: 'ZZ' }],
  ] as const)('rejects %s', (_label, tool, input) => {
    expect(schemas[tool].safeParse(input).success).toBe(false);
  });

  it('names the unknown hub in the error', () => {
    const result = schemas.get_weather_stats.safeParse({ hubIds: ['springfield-il'] });
    expect(result.error?.issues[0]?.message).toBe('Unknown hub ID: springfield-il');
  });

  it('can be converted to JSON Schema, so Claude sees the valid hub IDs', () => {
    for (const schema of Object.values(schemas)) {
      expect(() => z.toJSONSchema(schema)).not.toThrow();
    }
    const json = JSON.stringify(z.toJSONSchema(schemas.get_weather_stats));
    expect(json).toContain('"enum":["miami-fl","houston-tx","denver-co"]');
  });
});
