import {
  WeatherMetricSchema,
  type WeatherDay,
  type WeatherStatsResult,
  type WeatherValue,
} from '@hubcast/shared';
import { WEATHER_METRICS, describeMetric } from '../config/scoring.js';
import type { Dataset } from '../data/load.js';
import { ServiceError, resolveHubIds, round1 } from './common.js';
import { countMetric, dataYears, weatherValues } from './weatherMetrics.js';

function createPeriod(
  year: number | undefined,
  { startYear, endYear }: ReturnType<typeof dataYears>,
): WeatherStatsResult['period'] {
  return {
    kind: year === undefined ? 'yearlyAverage' : 'year',
    startYear: year ?? startYear,
    endYear: year ?? endYear,
    description:
      year === undefined
        ? `Average per year over ${startYear}–${endYear}. Day counts and totals are yearly averages; ` +
          `highest and lowest values are the extremes over the whole ${startYear}–${endYear} period.`
        : `Calendar year ${year} only. Day counts and totals are for ${year}.`,
  };
}

type HubWeatherStats = Omit<WeatherStatsResult['hubs'][number], 'rank'>;

function summarizeHub(
  hubId: string,
  days: readonly WeatherDay[],
  yearCount: number,
): HubWeatherStats {
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
}

/**
 * Sorts by a raw weather value: `lowestTempC` ascending, the others descending.
 * Missing values go last; ties are ordered by hub ID.
 */
export function sortByWeatherValue(hubs: readonly HubWeatherStats[], sortBy: WeatherValue) {
  const direction = sortBy === 'lowestTempC' ? 1 : -1;
  return [...hubs].sort((left, right) => {
    const leftValue = left.values[sortBy];
    const rightValue = right.values[sortBy];
    if (leftValue === null || rightValue === null) {
      if (leftValue !== rightValue) return leftValue === null ? 1 : -1;
    } else if (leftValue !== rightValue) {
      return (leftValue - rightValue) * direction;
    }
    return left.hubId.localeCompare(right.hubId);
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
      const yearCount = year === undefined ? years.count : 1;
      const hubs = ids.map((hubId) => {
        const allDays = dataset.weather.get(hubId)?.days ?? [];
        const days =
          year === undefined ? allDays : allDays.filter((day) => day.date.startsWith(`${year}-`));
        return summarizeHub(hubId, days, yearCount);
      });

      return {
        sortBy: sortBy ?? null,
        period: createPeriod(year, years),
        hubs:
          sortBy === undefined
            ? hubs.map((hub) => ({ ...hub, rank: null }))
            : sortByWeatherValue(hubs, sortBy).map((hub, index) => ({ ...hub, rank: index + 1 })),
      };
    },
  };
}

export type WeatherStatsService = ReturnType<typeof createWeatherStatsService>;
