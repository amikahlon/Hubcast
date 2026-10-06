import { HazardTypeSchema, NriHazardSchema, WeatherMetricSchema } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import {
  HAZARD_NRI,
  LEVEL_CUTOFFS,
  WEATHER_METRICS,
  WEIGHTS,
  describeMetric,
  levelFor,
  matchesMetric,
} from './scoring.js';

describe('scoring config', () => {
  it('has weights that sum to 1', () => {
    expect(WEIGHTS.weather + WEIGHTS.fema).toBeCloseTo(1);
  });

  it('has ordered level cutoffs inside 0–100', () => {
    expect(LEVEL_CUTOFFS.moderate).toBeGreaterThan(0);
    expect(LEVEL_CUTOFFS.high).toBeGreaterThan(LEVEL_CUTOFFS.moderate);
    expect(LEVEL_CUTOFFS.high).toBeLessThan(100);
  });

  it('maps every hazard to NRI hazards, and every NRI hazard to one hazard', () => {
    const mapped = HazardTypeSchema.options.flatMap((hazard) => {
      expect(HAZARD_NRI[hazard].length, hazard).toBeGreaterThan(0);
      return HAZARD_NRI[hazard];
    });
    expect([...mapped].sort()).toEqual([...NriHazardSchema.options].sort());
  });

  it('gives every scored metric a cap and a reason', () => {
    for (const metric of WeatherMetricSchema.options) {
      const config = WEATHER_METRICS[metric];
      expect(config.reason.length, metric).toBeGreaterThan(0);
      if (config.scoring) expect(config.scoring.cap, metric).toBeGreaterThan(0);
    }
  });

  it('scores weather for winter, flood, severeStorm and heat only', () => {
    const hazards = WeatherMetricSchema.options
      .map((metric) => WEATHER_METRICS[metric].scoring?.hazard)
      .filter((hazard) => hazard !== undefined);
    expect(new Set(hazards)).toEqual(new Set(['winter', 'flood', 'severeStorm', 'heat']));
  });

  it('keeps snowfallDays out of scoring', () => {
    expect(WEATHER_METRICS.snowfallDays.scoring).toBeUndefined();
  });
});

describe('levelFor', () => {
  it.each([
    [0, 'low'],
    [39.9, 'low'],
    [40, 'moderate'],
    [69.9, 'moderate'],
    [70, 'high'],
    [100, 'high'],
  ] as const)('%s is %s', (score, level) => {
    expect(levelFor(score)).toBe(level);
  });
});

describe('matchesMetric', () => {
  it('counts values at the threshold for "gte" metrics', () => {
    expect(matchesMetric(WEATHER_METRICS.heavySnow, 5)).toBe(true);
    expect(matchesMetric(WEATHER_METRICS.heavySnow, 4.9)).toBe(false);
  });

  it('does not count values at the threshold for "lt" metrics', () => {
    expect(matchesMetric(WEATHER_METRICS.freezing, 0)).toBe(false);
    expect(matchesMetric(WEATHER_METRICS.freezing, -0.1)).toBe(true);
  });
});

describe('describeMetric', () => {
  it('describes the rule with its unit', () => {
    expect(describeMetric(WEATHER_METRICS.heavySnow)).toBe('daily snowfall ≥ 5 cm');
    expect(describeMetric(WEATHER_METRICS.freezing)).toBe('daily min temperature < 0 °C');
  });
});
