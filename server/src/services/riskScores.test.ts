import type { HazardScore, HubRisk } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { createRiskScoresService } from './riskScores.js';
import { ALPHA, BRAVO, CHARLIE, makeDataset } from './testDataset.js';

const service = createRiskScoresService(
  makeDataset({ alpha: ALPHA, bravo: BRAVO, charlie: CHARLIE }),
);

function hazard(hub: HubRisk | undefined, name: string): HazardScore {
  const found = hub?.hazards.find((h) => h.hazard === name);
  if (!found) throw new Error(`No ${name} score`);
  return found;
}

describe('getRiskScores: hazard scores for alpha (calculated by hand)', () => {
  const alpha = service.getRiskScores(['alpha']).hubs[0];

  it('winter = 50% weather + 50% FEMA, using yearly averages', () => {
    // heavy snow: 5 days / 2 years = 2.5 per year; cap 10 -> 25
    // freezing:  10 days / 2 years = 5 per year; cap 120 -> 4.1667
    // weather = (25 + 4.1667) / 2 = 14.5833; FEMA = max(60, 80, null -> 0) = 80
    // winter = 0.5 × 14.5833 + 0.5 × 80 = 47.2917
    const winter = hazard(alpha, 'winter');
    expect(winter.score).toBe(47.3);
    expect(winter.level).toBe('moderate');
    expect(winter.weather?.score).toBe(14.6);
    expect(winter.fema.score).toBe(80);
  });

  it('reports the weather and FEMA drivers behind a hazard score', () => {
    const winter = hazard(alpha, 'winter');
    expect(winter.weather?.drivers).toEqual([
      {
        metric: 'heavySnow',
        label: 'Heavy snow days',
        definition: 'daily snowfall ≥ 5 cm',
        daysPerYear: 2.5,
        cap: 10,
        score: 25,
      },
      {
        metric: 'freezing',
        label: 'Freezing days',
        definition: 'daily min temperature < 0 °C',
        daysPerYear: 5,
        cap: 120,
        score: 4.2,
      },
    ]);
    expect(winter.fema.nri).toEqual([
      { hazard: 'winterWeather', score: 60, rating: 'Rated' },
      { hazard: 'iceStorm', score: 80, rating: 'Rated' },
      { hazard: 'coldWave', score: null, rating: 'Not Applicable' },
    ]);
  });

  it('flood = 0 weather + FEMA 50 (null coastal flooding ignored) = 25', () => {
    const flood = hazard(alpha, 'flood');
    expect(flood.score).toBe(25);
    expect(flood.level).toBe('low');
    expect(flood.weather?.score).toBe(0);
  });

  it('severeStorm: wind 1.5 per year / cap 30 -> 5; FEMA max(10, 20, 30) = 30; score 17.5', () => {
    const storm = hazard(alpha, 'severeStorm');
    expect(storm.weather?.drivers[0]?.score).toBe(5);
    expect(storm.fema.score).toBe(30);
    expect(storm.score).toBe(17.5);
  });

  it('uses FEMA only for hazards without weather metrics', () => {
    const wildfire = hazard(alpha, 'wildfire');
    expect(wildfire.weather).toBeNull();
    expect(wildfire.score).toBe(100);
    expect(wildfire.level).toBe('high');
  });

  it('treats a null FEMA score as 0 when calculating, but keeps it null in the drivers', () => {
    const hurricane = hazard(alpha, 'hurricane');
    expect(hurricane.score).toBe(0);
    expect(hurricane.fema.score).toBe(0);
    expect(hurricane.fema.nri).toEqual([
      { hazard: 'hurricane', score: null, rating: 'Not Applicable' },
    ]);
    // heat: no hot days and a null heat wave score
    expect(hazard(alpha, 'heat').score).toBe(0);
  });

  it('overall = average of the 6 hazard scores', () => {
    // (47.2917 + 25 + 0 + 17.5 + 0 + 100) / 6 = 31.6319
    expect(alpha?.overall).toEqual({ score: 31.6, level: 'low' });
  });
});

describe('getRiskScores: ranking', () => {
  it('ranks by overall score, highest first, and ties by hub ID', () => {
    // alpha 31.6; bravo and charlie both 15 (90 / 6) -> bravo before charlie
    const { sortBy, hubs } = service.getRiskScores();
    expect(sortBy).toBe('overall');
    expect(hubs.map((h) => [h.rank, h.hubId, h.overall.score])).toEqual([
      [1, 'alpha', 31.6],
      [2, 'bravo', 15],
      [3, 'charlie', 15],
    ]);
  });

  it('breaks ties by hub ID whatever the input order', () => {
    const { hubs } = service.getRiskScores(['charlie', 'bravo'], 'hurricane');
    expect(hubs.map((h) => h.hubId)).toEqual(['bravo', 'charlie']);
  });

  it('sorts by a hazard', () => {
    const hurricane = service.getRiskScores(undefined, 'hurricane');
    expect(hurricane.sortBy).toBe('hurricane');
    expect(hurricane.hubs.map((h) => h.hubId)).toEqual(['bravo', 'charlie', 'alpha']);

    const wildfire = service.getRiskScores(undefined, 'wildfire');
    expect(wildfire.hubs[0]?.hubId).toBe('alpha');
  });

  it('ranks only the requested hubs', () => {
    const { hubs } = service.getRiskScores(['charlie', 'alpha']);
    expect(hubs.map((h) => [h.rank, h.hubId])).toEqual([
      [1, 'alpha'],
      [2, 'charlie'],
    ]);
  });

  it('ranks on the unrounded score', () => {
    // Wildfire scores 49.96 and 50 both round to 50, but the real values differ,
    // so zzz ranks first even though aaa would win a tie on hub ID.
    const dataset = makeDataset({
      aaa: { nri: { wildfire: 49.96 } },
      zzz: { nri: { wildfire: 50 } },
    });
    const { hubs } = createRiskScoresService(dataset).getRiskScores(undefined, 'wildfire');
    expect(hubs.map((h) => h.hazards[5]?.score)).toEqual([50, 50]);
    expect(hubs.map((h) => h.hubId)).toEqual(['zzz', 'aaa']);
  });

  it('is deterministic', () => {
    expect(service.getRiskScores()).toEqual(service.getRiskScores());
  });

  it('throws for an unknown hub', () => {
    expect(() => service.getRiskScores(['nowhere'])).toThrow(/Unknown hub ID/);
  });
});

describe('getRiskScores: levels', () => {
  it('uses the rounded score so the level always matches the number shown', () => {
    // wildfire 39.96 rounds to 40.0, which is moderate
    const dataset = makeDataset({ edge: { nri: { wildfire: 39.96 } } });
    const wildfire = createRiskScoresService(dataset).getRiskScores().hubs[0]?.hazards[5];
    expect(wildfire).toMatchObject({ hazard: 'wildfire', score: 40, level: 'moderate' });
  });

  it('reaches high at 70 and low below 40', () => {
    const dataset = makeDataset({
      high: { nri: { wildfire: 70 } },
      low: { nri: { wildfire: 39.9 } },
    });
    const hubs = createRiskScoresService(dataset).getRiskScores().hubs;
    expect(
      hazard(
        hubs.find((h) => h.hubId === 'high'),
        'wildfire',
      ).level,
    ).toBe('high');
    expect(
      hazard(
        hubs.find((h) => h.hubId === 'low'),
        'wildfire',
      ).level,
    ).toBe('low');
  });
});
