import type { Hub } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { toWeatherFile } from './openMeteo.js';

const hub: Hub = {
  id: 'denver-co',
  name: 'Denver Hub',
  city: 'Denver',
  state: 'CO',
  region: 'West',
  lat: 39.7392,
  lon: -104.9903,
  countyFips: '08031',
  countyName: 'Denver County',
};
const period = { startDate: '2025-01-01', endDate: '2025-01-03' };

function response(overrides: Record<string, unknown> = {}) {
  return {
    latitude: 39.76,
    longitude: -105,
    daily_units: {
      time: 'iso8601',
      temperature_2m_max: '°C',
      temperature_2m_min: '°C',
      precipitation_sum: 'mm',
      snowfall_sum: 'cm',
      wind_gusts_10m_max: 'km/h',
    },
    daily: {
      time: ['2025-01-01', '2025-01-02', '2025-01-03'],
      temperature_2m_max: [0.3, null, -4.3],
      temperature_2m_min: [-8.8, -4.2, -12.5],
      precipitation_sum: [0.2, 4.3, 0],
      snowfall_sum: [0.14, 3.01, 0],
      wind_gusts_10m_max: [17.6, 20.9, 18.7],
    },
    ...overrides,
  };
}

describe('toWeatherFile', () => {
  it('converts the response, keeping null values', () => {
    const file = toWeatherFile(hub, response(), period);
    expect(file).toMatchObject({
      hubId: 'denver-co',
      lat: 39.7392,
      lon: -104.9903,
      ...period,
    });
    expect(file.days).toHaveLength(3);
    expect(file.days[0]).toEqual({
      date: '2025-01-01',
      tempMax: 0.3,
      tempMin: -8.8,
      precipitation: 0.2,
      snowfall: 0.14,
      windGustMax: 17.6,
    });
    expect(file.days[1]?.tempMax).toBeNull();
  });

  it('rejects non-metric units', () => {
    const imperial = response({
      daily_units: { ...response().daily_units, temperature_2m_max: '°F' },
    });
    expect(() => toWeatherFile(hub, imperial, period)).toThrow(/denver-co/);
  });

  it('rejects arrays of different lengths', () => {
    const bad = response({ daily: { ...response().daily, snowfall_sum: [0, 0] } });
    expect(() => toWeatherFile(hub, bad, period)).toThrow(/different lengths/);
  });

  it('rejects a response that is not the requested period', () => {
    expect(() => toWeatherFile(hub, response(), { ...period, endDate: '2025-01-31' })).toThrow(
      /expected 2025-01-01\.\.2025-01-31/,
    );
  });

  it('rejects an API error body', () => {
    expect(() => toWeatherFile(hub, { error: true, reason: 'Bad request' }, period)).toThrow(
      /Invalid Open-Meteo response/,
    );
  });
});
