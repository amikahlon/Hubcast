import { NriHazardSchema, type HubHazards, type NriHazard, type WeatherDay } from '@hubcast/shared';
import type { Dataset } from '../data/dataset.js';

// Small synthetic dataset for service tests: 2 years (2024, 2025) with 10 days each,
// so expected values are easy to calculate by hand.

type DayPatch = { [K in keyof Omit<WeatherDay, 'date'>]?: number | null };

const BENIGN = { tempMax: 20, tempMin: 10, precipitation: 0, snowfall: 0, windGustMax: 10 };
const DAYS_PER_YEAR = 10;

/** 10 days for a year. `patches[i]` overrides day i+1 of the benign default. */
function makeYear(year: number, patches: readonly DayPatch[] = []): WeatherDay[] {
  return Array.from({ length: DAYS_PER_YEAR }, (_, i) => ({
    date: `${year}-01-${String(i + 1).padStart(2, '0')}`,
    ...BENIGN,
    ...patches[i],
  }));
}

/** NRI scores by hazard; unlisted hazards score 0. `null` means "Not Applicable". */
function makeNri(scores: Partial<Record<NriHazard, number | null>>): HubHazards['hazards'] {
  return Object.fromEntries(
    NriHazardSchema.options.map((hazard) => {
      const score = scores[hazard] === undefined ? 0 : scores[hazard];
      return [hazard, { score, rating: score === null ? 'Not Applicable' : 'Rated' }];
    }),
  ) as HubHazards['hazards'];
}

export interface TestHub {
  y2024?: readonly DayPatch[];
  y2025?: readonly DayPatch[];
  nri?: Partial<Record<NriHazard, number | null>>;
}

export function makeDataset(hubs: Record<string, TestHub>): Dataset {
  const dataset: Dataset = {
    meta: {
      refreshedAt: '2026-01-01',
      weather: { source: 'test', startDate: '2024-01-01', endDate: '2025-12-31' },
      hazards: { source: 'test', version: 'test' },
    },
    hazards: {},
    weather: new Map(),
  };
  for (const [hubId, hub] of Object.entries(hubs)) {
    dataset.weather.set(hubId, {
      hubId,
      lat: 0,
      lon: 0,
      startDate: '2024-01-01',
      endDate: '2025-12-31',
      days: [...makeYear(2024, hub.y2024), ...makeYear(2025, hub.y2025)],
    });
    dataset.hazards[hubId] = { countyFips: '00000', hazards: makeNri(hub.nri ?? {}) };
  }
  return dataset;
}

/** Hub used in most tests; all expected values below are calculated by hand from this data. */
export const ALPHA: TestHub = {
  // 2024: 4 heavy snow days, 6 freezing days, 3 high wind days.
  y2024: [
    { snowfall: 6, tempMin: -5, windGustMax: 70 },
    { snowfall: 6, tempMin: -5, windGustMax: 70 },
    { snowfall: 6, tempMin: -5, windGustMax: 70 },
    { snowfall: 6, tempMin: -5 },
    { tempMin: -1 },
    { tempMin: -1 },
  ],
  // 2025: 1 heavy snow day, 4 freezing days.
  y2025: [{ snowfall: 7, tempMin: -3 }, { tempMin: -2 }, { tempMin: -2 }, { tempMin: -2 }],
  nri: {
    winterWeather: 60,
    iceStorm: 80,
    coldWave: null,
    inlandFlooding: 50,
    coastalFlooding: null,
    hurricane: null,
    tornado: 10,
    strongWind: 20,
    hail: 30,
    heatWave: null,
    wildfire: 100,
  },
};

/** No weather events; only hurricane exposure. */
export const BRAVO: TestHub = { nri: { hurricane: 90 } };
/** Identical to BRAVO, to test ties. */
export const CHARLIE: TestHub = { nri: { hurricane: 90 } };
