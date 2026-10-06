import { describe, expect, it } from 'vitest';
import {
  HazardExposureResultSchema,
  RiskScoresResultSchema,
  RiskSortBySchema,
  WeatherStatsResultSchema,
} from './risk.js';

const metric = {
  metric: 'heavySnow',
  label: 'Heavy snow days',
  definition: 'daily snowfall ≥ 5 cm',
  days: 2.5,
  percentage: 25,
};

describe('RiskSortBySchema', () => {
  it('accepts overall and the six hazards', () => {
    expect(RiskSortBySchema.options).toEqual([
      'overall',
      'winter',
      'flood',
      'hurricane',
      'severeStorm',
      'heat',
      'wildfire',
    ]);
  });

  it('rejects other values', () => {
    expect(RiskSortBySchema.safeParse('earthquake').success).toBe(false);
  });
});

describe('WeatherStatsResultSchema', () => {
  const result = {
    period: { kind: 'yearlyAverage', startYear: 2023, endYear: 2025 },
    hubs: [{ hubId: 'denver-co', metrics: [metric] }],
  };

  it('accepts a valid result', () => {
    expect(WeatherStatsResultSchema.parse(result)).toEqual(result);
  });

  it.each([
    ['percentage above 100', { ...metric, percentage: 101 }],
    ['negative days', { ...metric, days: -1 }],
    ['unknown metric', { ...metric, metric: 'tornadoDays' }],
  ])('rejects %s', (_label, bad) => {
    const input = { ...result, hubs: [{ hubId: 'denver-co', metrics: [bad] }] };
    expect(WeatherStatsResultSchema.safeParse(input).success).toBe(false);
  });
});

describe('HazardExposureResultSchema', () => {
  it('accepts null NRI scores', () => {
    const input = {
      hubs: [
        {
          hubId: 'denver-co',
          hazards: [
            {
              hazard: 'hurricane',
              nri: [{ hazard: 'hurricane', score: null, rating: 'Not Applicable' }],
            },
          ],
        },
      ],
    };
    expect(HazardExposureResultSchema.parse(input)).toEqual(input);
  });
});

describe('RiskScoresResultSchema', () => {
  const hazard = {
    hazard: 'wildfire',
    score: 61,
    level: 'moderate',
    weather: null,
    fema: { score: 61, nri: [{ hazard: 'wildfire', score: 61, rating: 'Relatively Moderate' }] },
  };
  const result = {
    sortBy: 'overall',
    hubs: [
      {
        hubId: 'denver-co',
        rank: 1,
        overall: { score: 51.4, level: 'moderate' },
        hazards: [hazard],
      },
    ],
  };

  it('accepts a valid result', () => {
    expect(RiskScoresResultSchema.parse(result)).toEqual(result);
  });

  it.each([
    ['rank 0', { rank: 0 }],
    ['unknown level', { overall: { score: 51.4, level: 'extreme' } }],
    ['score above 100', { overall: { score: 101, level: 'high' } }],
  ])('rejects %s', (_label, override) => {
    const input = { ...result, hubs: [{ ...result.hubs[0], ...override }] };
    expect(RiskScoresResultSchema.safeParse(input).success).toBe(false);
  });
});
