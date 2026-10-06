import {
  HazardTypeSchema,
  WeatherMetricSchema,
  type HazardScore,
  type HazardType,
  type HubRisk,
  type RiskScoresResult,
  type RiskSortBy,
  type WeatherDriver,
} from '@hubcast/shared';
import {
  HAZARD_NRI,
  WEATHER_METRICS,
  WEIGHTS,
  describeMetric,
  levelFor,
} from '../config/scoring.js';
import type { Dataset } from '../data/dataset.js';
import { countMetric, dataYears } from './weatherStats.js';
import { resolveHubIds, round1 } from './util.js';

const HAZARDS = HazardTypeSchema.options;

/** Scored weather metrics per hazard (empty for hurricane and wildfire). */
const METRICS_BY_HAZARD = Object.fromEntries(
  HAZARDS.map((hazard) => [
    hazard,
    WeatherMetricSchema.options.filter(
      (metric) => WEATHER_METRICS[metric].scoring?.hazard === hazard,
    ),
  ]),
) as Record<HazardType, ReturnType<typeof WeatherMetricSchema.options.filter>>;

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** A hub's scores before rounding. Ranking uses these, output uses the rounded copies. */
interface RawHubRisk {
  hubId: string;
  overall: number;
  hazards: Record<HazardType, number>;
  output: Omit<HubRisk, 'rank'>;
}

export function createRiskScoresService(dataset: Dataset) {
  const yearCount = dataYears(dataset.meta).count;

  function scoreHub(hubId: string): RawHubRisk {
    const days = dataset.weather.get(hubId)?.days ?? [];
    const nri = dataset.hazards[hubId]?.hazards;
    const rawScores = {} as Record<HazardType, number>;

    const hazards: HazardScore[] = HAZARDS.map((hazard) => {
      const readings = HAZARD_NRI[hazard].map((name) => ({
        hazard: name,
        score: nri?.[name]?.score ?? null,
        rating: nri?.[name]?.rating ?? 'No Rating',
      }));
      // Highest related NRI score; "not applicable" (null) counts as 0.
      const fema = Math.max(...readings.map((reading) => reading.score ?? 0));

      const metrics = METRICS_BY_HAZARD[hazard];
      const drivers: WeatherDriver[] = [];
      const metricScores: number[] = [];
      for (const metric of metrics) {
        const config = WEATHER_METRICS[metric];
        const cap = config.scoring?.cap ?? 1;
        const daysPerYear = countMetric(days, metric).matching / yearCount;
        const score = Math.min(daysPerYear / cap, 1) * 100;
        metricScores.push(score);
        drivers.push({
          metric,
          label: config.label,
          definition: describeMetric(config),
          daysPerYear: round1(daysPerYear),
          cap,
          score: round1(score),
        });
      }

      const weather = metricScores.length > 0 ? mean(metricScores) : null;
      const score = weather === null ? fema : WEIGHTS.weather * weather + WEIGHTS.fema * fema;
      rawScores[hazard] = score;

      const rounded = round1(score);
      return {
        hazard,
        score: rounded,
        level: levelFor(rounded),
        weather: weather === null ? null : { score: round1(weather), drivers },
        fema: { score: round1(fema), nri: readings },
      };
    });

    const overall = mean(Object.values(rawScores));
    const overallRounded = round1(overall);
    return {
      hubId,
      overall,
      hazards: rawScores,
      output: {
        hubId,
        overall: { score: overallRounded, level: levelFor(overallRounded) },
        hazards,
      },
    };
  }

  return {
    /** Scores for the hubs (default: all), ranked by `sortBy`. Ties are broken by hub ID. */
    getRiskScores(hubIds?: readonly string[], sortBy: RiskSortBy = 'overall'): RiskScoresResult {
      const ids = resolveHubIds(dataset, hubIds ?? [...dataset.weather.keys()]);
      const sortValue = (hub: RawHubRisk): number =>
        sortBy === 'overall' ? hub.overall : hub.hazards[sortBy];

      // Rank on the unrounded score; rounding is only for output.
      const ranked = ids
        .map(scoreHub)
        .sort((a, b) => sortValue(b) - sortValue(a) || a.hubId.localeCompare(b.hubId));

      return {
        sortBy,
        hubs: ranked.map((hub, index) => ({ rank: index + 1, ...hub.output })),
      };
    },
  };
}

export type RiskScoresService = ReturnType<typeof createRiskScoresService>;
