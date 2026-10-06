import { describe, expect, it } from 'vitest';
import {
  DataMetaSchema,
  HazardsFileSchema,
  NriHazardSchema,
  WeatherDaySchema,
  WeatherFileSchema,
} from './data.js';

const day = {
  date: '2025-01-01',
  tempMax: 3.5,
  tempMin: -4,
  precipitation: 0,
  snowfall: 1.2,
  windGustMax: 40,
};

describe('WeatherDaySchema', () => {
  it('accepts a valid day', () => {
    expect(WeatherDaySchema.parse(day)).toEqual(day);
  });

  it('accepts null values for missing source data', () => {
    const missing = {
      date: '2025-01-02',
      tempMax: null,
      tempMin: null,
      precipitation: null,
      snowfall: null,
      windGustMax: null,
    };
    expect(WeatherDaySchema.parse(missing)).toEqual(missing);
  });

  it.each([
    ['invalid date', { date: '01/02/2025' }],
    ['negative precipitation', { precipitation: -1 }],
    ['negative snowfall', { snowfall: -0.1 }],
    ['text temperature', { tempMax: 'hot' }],
  ])('rejects %s', (_label, override) => {
    expect(WeatherDaySchema.safeParse({ ...day, ...override }).success).toBe(false);
  });

  it('rejects a missing field', () => {
    const { snowfall: _omitted, ...rest } = day;
    expect(WeatherDaySchema.safeParse(rest).success).toBe(false);
  });
});

describe('WeatherFileSchema', () => {
  const file = {
    hubId: 'denver-co',
    lat: 39.7,
    lon: -105,
    startDate: '2025-01-01',
    endDate: '2025-01-01',
    days: [day],
  };

  it('accepts a valid file', () => {
    expect(WeatherFileSchema.parse(file)).toEqual(file);
  });

  it('rejects a file without days', () => {
    expect(WeatherFileSchema.safeParse({ ...file, days: [] }).success).toBe(false);
  });
});

describe('HazardsFileSchema', () => {
  const hazards = Object.fromEntries(
    NriHazardSchema.options.map((hazard) => [hazard, { score: 42.5, rating: 'Relatively Low' }]),
  );
  const entry = { countyFips: '08031', hazards };

  it('accepts hazards keyed by hub ID, including null scores', () => {
    const withNull = {
      ...entry,
      hazards: { ...hazards, coastalFlooding: { score: null, rating: 'Not Applicable' } },
    };
    expect(HazardsFileSchema.parse({ 'denver-co': withNull })).toEqual({ 'denver-co': withNull });
  });

  it('rejects an entry missing a hazard', () => {
    const { wildfire: _omitted, ...rest } = hazards;
    expect(HazardsFileSchema.safeParse({ 'denver-co': { ...entry, hazards: rest } }).success).toBe(
      false,
    );
  });

  it('rejects a score above 100', () => {
    const bad = { ...entry, hazards: { ...hazards, hail: { score: 101, rating: 'Very High' } } };
    expect(HazardsFileSchema.safeParse({ 'denver-co': bad }).success).toBe(false);
  });

  it('rejects an invalid county FIPS', () => {
    expect(
      HazardsFileSchema.safeParse({ 'denver-co': { ...entry, countyFips: '8031' } }).success,
    ).toBe(false);
  });
});

describe('DataMetaSchema', () => {
  const meta = {
    refreshedAt: '2026-10-06',
    weather: { source: 'Open-Meteo', startDate: '2023-01-01', endDate: '2025-12-31' },
    hazards: { source: 'FEMA NRI', version: 'December 2025' },
  };

  it('accepts valid metadata', () => {
    expect(DataMetaSchema.parse(meta)).toEqual(meta);
  });

  it('rejects an invalid refresh date', () => {
    expect(DataMetaSchema.safeParse({ ...meta, refreshedAt: 'yesterday' }).success).toBe(false);
  });
});
