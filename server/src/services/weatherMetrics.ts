import type { DataMeta, WeatherDay, WeatherMetric, WeatherValues } from '@hubcast/shared';
import { WEATHER_METRICS, matchesMetric } from '../config/scoring.js';
import { round1 } from './common.js';

/** Years covered by the weather data, e.g. 2023 to 2025. */
export function dataYears(meta: DataMeta): { startYear: number; endYear: number; count: number } {
  const startYear = Number(meta.weather.startDate.slice(0, 4));
  const endYear = Number(meta.weather.endDate.slice(0, 4));
  return { startYear, endYear, count: endYear - startYear + 1 };
}

/** Days matching the metric, and days that have a value for it. */
export function countMetric(
  days: readonly WeatherDay[],
  metric: WeatherMetric,
): { matching: number; valid: number } {
  const config = WEATHER_METRICS[metric];
  let matching = 0;
  let valid = 0;
  for (const day of days) {
    const value = day[config.field];
    if (value === null) continue;
    valid++;
    if (matchesMetric(config, value)) matching++;
  }
  return { matching, valid };
}

/** Non-missing values of one field. */
function fieldValues(
  days: readonly WeatherDay[],
  field: Exclude<keyof WeatherDay, 'date'>,
): number[] {
  return days.flatMap((day) => {
    const value = day[field];
    return value === null ? [] : [value];
  });
}

function sumOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

/** Totals (divided by `yearCount`) and extremes. `null` only when there is no data for a value. */
export function weatherValues(days: readonly WeatherDay[], yearCount: number): WeatherValues {
  const snowfall = fieldValues(days, 'snowfall');
  const precipitation = fieldValues(days, 'precipitation');
  const wind = fieldValues(days, 'windGustMax');
  const tempMax = fieldValues(days, 'tempMax');
  const tempMin = fieldValues(days, 'tempMin');
  const perYear = (total: number | null) => (total === null ? null : round1(total / yearCount));
  const max = (values: readonly number[]) => (values.length === 0 ? null : Math.max(...values));
  const min = (values: readonly number[]) => (values.length === 0 ? null : Math.min(...values));

  return {
    totalSnowfallCm: perYear(sumOrNull(snowfall)),
    totalPrecipitationMm: perYear(sumOrNull(precipitation)),
    maxSnowfallCm: max(snowfall),
    maxPrecipitationMm: max(precipitation),
    maxWindGustKmh: max(wind),
    highestTempC: max(tempMax),
    lowestTempC: min(tempMin),
  };
}
