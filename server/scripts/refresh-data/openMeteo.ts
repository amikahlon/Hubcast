import type { Hub, WeatherFile } from '@hubcast/shared';
import { z } from 'zod';
import { fetchJson } from './http.js';

export const OPEN_METEO_SOURCE = 'Open-Meteo Historical Weather API';
const ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';

const nullableNumbers = z.array(z.number().nullable());

/** The parts of the Open-Meteo response we use. Units are checked, not assumed. */
const OpenMeteoResponseSchema = z
  .object({
    daily_units: z.object({
      temperature_2m_max: z.literal('°C'),
      temperature_2m_min: z.literal('°C'),
      precipitation_sum: z.literal('mm'),
      snowfall_sum: z.literal('cm'),
      wind_gusts_10m_max: z.literal('km/h'),
    }),
    daily: z.object({
      time: z.array(z.iso.date()).min(1),
      temperature_2m_max: nullableNumbers,
      temperature_2m_min: nullableNumbers,
      precipitation_sum: nullableNumbers,
      snowfall_sum: nullableNumbers,
      wind_gusts_10m_max: nullableNumbers,
    }),
  })
  .refine(
    ({ daily }) => Object.values(daily).every((values) => values.length === daily.time.length),
    {
      message: 'Daily arrays have different lengths',
    },
  );

export function toWeatherFile(
  hub: Hub,
  raw: unknown,
  period: { startDate: string; endDate: string },
): WeatherFile {
  const result = OpenMeteoResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid Open-Meteo response for ${hub.id}:\n${z.prettifyError(result.error)}`);
  }
  const { daily } = result.data;
  const first = daily.time[0];
  const last = daily.time[daily.time.length - 1];
  if (first !== period.startDate || last !== period.endDate) {
    throw new Error(
      `Open-Meteo returned ${first}..${last} for ${hub.id}, expected ${period.startDate}..${period.endDate}`,
    );
  }
  return {
    hubId: hub.id,
    lat: hub.lat,
    lon: hub.lon,
    startDate: period.startDate,
    endDate: period.endDate,
    days: daily.time.map((date, i) => ({
      date,
      tempMax: daily.temperature_2m_max[i] ?? null,
      tempMin: daily.temperature_2m_min[i] ?? null,
      precipitation: daily.precipitation_sum[i] ?? null,
      snowfall: daily.snowfall_sum[i] ?? null,
      windGustMax: daily.wind_gusts_10m_max[i] ?? null,
    })),
  };
}

export async function fetchWeather(
  hub: Hub,
  period: { startDate: string; endDate: string },
): Promise<WeatherFile> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('latitude', String(hub.lat));
  url.searchParams.set('longitude', String(hub.lon));
  url.searchParams.set('start_date', period.startDate);
  url.searchParams.set('end_date', period.endDate);
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_gusts_10m_max',
  );
  url.searchParams.set('timezone', 'auto');
  return toWeatherFile(hub, await fetchJson(url), period);
}
