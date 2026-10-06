import { describe, expect, it } from 'vitest';
import { ServiceError } from './errors.js';
import { ALPHA, makeDataset } from './testDataset.js';
import { createWeatherStatsService } from './weatherStats.js';

// Each year in the test dataset has 10 days.
const dataset = makeDataset({
  alpha: ALPHA,
  // Values on both sides of every threshold in 2024; 2025 is benign.
  edge: {
    y2024: [
      { snowfall: 5 }, // heavy snow (≥ 5)
      { snowfall: 4.9 },
      { tempMin: 0, snowfall: 0.1 }, // not freezing (< 0); snowfall day (≥ 0.1)
      { tempMin: -0.1 }, // freezing
      { precipitation: 25 }, // heavy rain (≥ 25)
      { precipitation: 24.9 },
      { windGustMax: 60 }, // high wind (≥ 60)
      { windGustMax: 59.9 },
      { tempMax: 35 }, // hot (≥ 35)
      { tempMax: 34.9, snowfall: 0.09 }, // not hot; not a snowfall day
    ],
  },
  // 2024: snowfall is missing on 2 days and ≥ 5 cm on 3 days.
  gap: {
    y2024: [
      { snowfall: null },
      { snowfall: null },
      { snowfall: 6 },
      { snowfall: 6 },
      { snowfall: 6 },
    ],
  },
});
const service = createWeatherStatsService(dataset);

function metric(hubId: string, name: string, result: ReturnType<typeof service.getWeatherStats>) {
  const found = result.hubs
    .find((hub) => hub.hubId === hubId)
    ?.metrics.find((m) => m.metric === name);
  if (!found) throw new Error(`No ${name} for ${hubId}`);
  return found;
}

describe('getWeatherStats', () => {
  it('counts days at the metric thresholds', () => {
    const result = service.getWeatherStats(['edge'], 2024);
    const days = Object.fromEntries(result.hubs[0]?.metrics.map((m) => [m.metric, m.days]) ?? []);
    expect(days).toEqual({
      heavySnow: 1,
      freezing: 1,
      heavyRain: 1,
      highWind: 1,
      hot: 1,
      snowfallDays: 3,
    });
    expect(metric('edge', 'heavySnow', result).percentage).toBe(10);
    expect(metric('edge', 'snowfallDays', result).percentage).toBe(30);
  });

  it('returns one year when a year is given', () => {
    const y2024 = service.getWeatherStats(['alpha'], 2024);
    const y2025 = service.getWeatherStats(['alpha'], 2025);
    expect(y2024.period).toEqual({ kind: 'year', startYear: 2024, endYear: 2024 });
    expect(metric('alpha', 'heavySnow', y2024)).toMatchObject({ days: 4, percentage: 40 });
    expect(metric('alpha', 'heavySnow', y2025)).toMatchObject({ days: 1, percentage: 10 });
  });

  it('returns the yearly average without a year', () => {
    const result = service.getWeatherStats(['alpha']);
    expect(result.period).toEqual({ kind: 'yearlyAverage', startYear: 2024, endYear: 2025 });
    // 5 heavy snow days over 2 years and 20 days.
    expect(metric('alpha', 'heavySnow', result)).toMatchObject({ days: 2.5, percentage: 25 });
    // 10 freezing days over 2 years and 20 days.
    expect(metric('alpha', 'freezing', result)).toMatchObject({ days: 5, percentage: 50 });
  });

  it('includes the label and rule of each metric', () => {
    const heavySnow = metric('alpha', 'heavySnow', service.getWeatherStats(['alpha']));
    expect(heavySnow.label).toBe('Heavy snow days');
    expect(heavySnow.definition).toBe('daily snowfall ≥ 5 cm');
  });

  it('excludes days with a missing value from the percentage', () => {
    const y2024 = service.getWeatherStats(['gap'], 2024);
    // 3 matching days out of the 8 days that have a snowfall value.
    expect(metric('gap', 'heavySnow', y2024)).toMatchObject({ days: 3, percentage: 37.5 });
    // Average: 3 matching days out of 18 valid days; 3 days over 2 years.
    expect(metric('gap', 'heavySnow', service.getWeatherStats(['gap']))).toMatchObject({
      days: 1.5,
      percentage: 16.7,
    });
  });

  it('returns results for several hubs, without duplicates, in input order', () => {
    const result = service.getWeatherStats(['edge', 'alpha', 'edge']);
    expect(result.hubs.map((hub) => hub.hubId)).toEqual(['edge', 'alpha']);
  });

  it.each([2023, 2026])('throws OUT_OF_RANGE for %s', (year) => {
    expect(() => service.getWeatherStats(['alpha'], year)).toThrow(ServiceError);
    try {
      service.getWeatherStats(['alpha'], year);
    } catch (error) {
      expect(error).toMatchObject({ code: 'OUT_OF_RANGE' });
      expect((error as Error).message).toContain('2024–2025');
    }
  });

  it('throws NOT_FOUND for an unknown hub', () => {
    expect(() => service.getWeatherStats(['nowhere'])).toThrow(/Unknown hub ID: nowhere/);
  });
});
