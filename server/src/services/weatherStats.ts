import type { DataMeta, WeatherDay, WeatherMetric, WeatherStatsResult } from '@hubcast/shared';
import { WeatherMetricSchema } from '@hubcast/shared';
import { WEATHER_METRICS, describeMetric, matchesMetric } from '../config/scoring.js';
import type { Dataset } from '../data/load.js';
import { ServiceError, resolveHubIds, round1 } from './common.js';

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

export function createWeatherStatsService(dataset: Dataset) {
  const years = dataYears(dataset.meta);

  return {
    /** Days and percentage of days per metric: for one year, or the yearly average without one. */
    getWeatherStats(hubIds: readonly string[], year?: number): WeatherStatsResult {
      if (year !== undefined && (year < years.startYear || year > years.endYear)) {
        throw new ServiceError(
          'OUT_OF_RANGE',
          `No weather data for ${year}. Data covers ${years.startYear}–${years.endYear}.`,
        );
      }
      const ids = resolveHubIds(dataset, hubIds);

      return {
        period: {
          kind: year === undefined ? 'yearlyAverage' : 'year',
          startYear: year ?? years.startYear,
          endYear: year ?? years.endYear,
        },
        hubs: ids.map((hubId) => {
          const all = dataset.weather.get(hubId)?.days ?? [];
          const days =
            year === undefined ? all : all.filter((day) => day.date.startsWith(`${year}-`));
          const yearCount = year === undefined ? years.count : 1;

          return {
            hubId,
            metrics: WeatherMetricSchema.options.map((metric) => {
              const config = WEATHER_METRICS[metric];
              const { matching, valid } = countMetric(days, metric);
              return {
                metric,
                label: config.label,
                definition: describeMetric(config),
                days: round1(matching / yearCount),
                percentage: valid === 0 ? 0 : round1((matching / valid) * 100),
              };
            }),
          };
        }),
      };
    },
  };
}

export type WeatherStatsService = ReturnType<typeof createWeatherStatsService>;
