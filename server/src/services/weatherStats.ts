import type {
  DataMeta,
  WeatherDay,
  WeatherMetric,
  WeatherStatsResult,
  WeatherValue,
  WeatherValues,
} from '@hubcast/shared';
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

/** Non-missing values of one field. */
function fieldValues(days: readonly WeatherDay[], field: Exclude<keyof WeatherDay, 'date'>) {
  return days.flatMap((day) => (day[field] === null ? [] : [day[field]]));
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
  const max = (values: number[]) => (values.length === 0 ? null : Math.max(...values));
  const min = (values: number[]) => (values.length === 0 ? null : Math.min(...values));

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

function describePeriod(year: number | undefined, startYear: number, endYear: number): string {
  if (year !== undefined) {
    return `Calendar year ${year} only. Day counts and totals are for ${year}.`;
  }
  return (
    `Average per year over ${startYear}–${endYear}. Day counts and totals are yearly averages; ` +
    `highest and lowest values are the extremes over the whole ${startYear}–${endYear} period.`
  );
}

type HubWeatherStats = Omit<WeatherStatsResult['hubs'][number], 'rank'>;

/**
 * Sorts by a raw weather value: `lowestTempC` ascending, the others descending.
 * Missing values go last; ties are ordered by hub ID.
 */
export function sortByWeatherValue(hubs: HubWeatherStats[], sortBy: WeatherValue) {
  const direction = sortBy === 'lowestTempC' ? 1 : -1;
  return [...hubs].sort((a, b) => {
    const x = a.values[sortBy];
    const y = b.values[sortBy];
    if (x === null || y === null) {
      if (x !== y) return x === null ? 1 : -1;
    } else if (x !== y) {
      return (x - y) * direction;
    }
    return a.hubId.localeCompare(b.hubId);
  });
}

export function createWeatherStatsService(dataset: Dataset) {
  const years = dataYears(dataset.meta);

  return {
    /**
     * Day counts per metric plus raw totals and extremes: for one year, or the yearly average
     * without one. All hubs without `hubIds`; sorted and ranked with `sortBy`.
     */
    getWeatherStats(
      hubIds?: readonly string[],
      year?: number,
      sortBy?: WeatherValue,
    ): WeatherStatsResult {
      if (year !== undefined && (year < years.startYear || year > years.endYear)) {
        throw new ServiceError(
          'OUT_OF_RANGE',
          `No weather data for ${year}. Data covers ${years.startYear}–${years.endYear}.`,
        );
      }
      const ids = resolveHubIds(dataset, hubIds ?? [...dataset.weather.keys()]);
      const hubs = ids.map((hubId): HubWeatherStats => {
        const all = dataset.weather.get(hubId)?.days ?? [];
        const days =
          year === undefined ? all : all.filter((day) => day.date.startsWith(`${year}-`));
        const yearCount = year === undefined ? years.count : 1;

        return {
          hubId,
          values: weatherValues(days, yearCount),
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
      });

      return {
        sortBy: sortBy ?? null,
        period: {
          kind: year === undefined ? 'yearlyAverage' : 'year',
          startYear: year ?? years.startYear,
          endYear: year ?? years.endYear,
          description: describePeriod(year, years.startYear, years.endYear),
        },
        hubs:
          sortBy === undefined
            ? hubs.map((hub) => ({ ...hub, rank: null }))
            : sortByWeatherValue(hubs, sortBy).map((hub, index) => ({ ...hub, rank: index + 1 })),
      };
    },
  };
}

export type WeatherStatsService = ReturnType<typeof createWeatherStatsService>;
