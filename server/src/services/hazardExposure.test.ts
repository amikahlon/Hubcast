import { describe, expect, it } from 'vitest';
import { createHazardExposureService } from './hazardExposure.js';
import { ALPHA, BRAVO, makeDataset } from './testDataset.js';

const service = createHazardExposureService(makeDataset({ alpha: ALPHA, bravo: BRAVO }));

describe('getHazardExposure', () => {
  it('returns all six hazards by default, in canonical order', () => {
    const [hub] = service.getHazardExposure(['alpha']).hubs;
    expect(hub?.hazards.map((h) => h.hazard)).toEqual([
      'winter',
      'flood',
      'hurricane',
      'severeStorm',
      'heat',
      'wildfire',
    ]);
  });

  it('returns the related NRI hazards with score and rating', () => {
    const [hub] = service.getHazardExposure(['alpha'], ['winter']).hubs;
    expect(hub?.hazards).toEqual([
      {
        hazard: 'winter',
        nri: [
          { hazard: 'winterWeather', score: 60, rating: 'Rated' },
          { hazard: 'iceStorm', score: 80, rating: 'Rated' },
          { hazard: 'coldWave', score: null, rating: 'Not Applicable' },
        ],
      },
    ]);
  });

  it('keeps null scores as null', () => {
    const [hub] = service.getHazardExposure(['alpha'], ['hurricane']).hubs;
    expect(hub?.hazards[0]?.nri).toEqual([
      { hazard: 'hurricane', score: null, rating: 'Not Applicable' },
    ]);
  });

  it('filters hazards and keeps canonical order', () => {
    const [hub] = service.getHazardExposure(['bravo'], ['wildfire', 'flood']).hubs;
    expect(hub?.hazards.map((h) => h.hazard)).toEqual(['flood', 'wildfire']);
  });

  it('returns several hubs without duplicates', () => {
    const result = service.getHazardExposure(['bravo', 'alpha', 'bravo'], ['hurricane']);
    expect(result.hubs.map((h) => h.hubId)).toEqual(['bravo', 'alpha']);
    expect(result.hubs[0]?.hazards[0]?.nri[0]?.score).toBe(90);
  });

  it('throws for an unknown hub', () => {
    expect(() => service.getHazardExposure(['nowhere'])).toThrow(/Unknown hub ID/);
  });
});
