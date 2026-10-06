import {
  HazardTypeSchema,
  WeatherMetricSchema,
  type HazardScore,
  type HazardType,
  type HubRisk,
  type WeatherDay,
  type WeatherDriver,
  type WeatherMetric,
} from '@hubcast/shared';
import { WEATHER_METRICS, WEIGHTS, describeMetric, levelFor } from '../config/scoring.js';
import type { Dataset } from '../data/load.js';
import { readNriReadings, round1 } from './common.js';
import { countMetric } from './weatherMetrics.js';

const HAZARDS = HazardTypeSchema.options;

/** Scored weather metrics per hazard (empty for hurricane and wildfire). */
const METRICS_BY_HAZARD = Object.fromEntries(
  HAZARDS.map((hazard) => [
    hazard,
    WeatherMetricSchema.options.filter(
      (metric) => WEATHER_METRICS[metric].scoring?.hazard === hazard,
    ),
  ]),
) as Record<HazardType, WeatherMetric[]>;

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** A hub's scores before rounding. Ranking uses these, output uses the rounded copies. */
export interface RawHubRisk {
  hubId: string;
  overall: number;
  hazards: Record<HazardType, number>;
  output: Omit<HubRisk, 'rank'>;
}

function scoreWeather(days: readonly WeatherDay[], hazard: HazardType, yearCount: number) {
  const drivers: WeatherDriver[] = [];
  const metricScores: number[] = [];
  for (const metric of METRICS_BY_HAZARD[hazard]) {
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
  return { score: metricScores.length > 0 ? mean(metricScores) : null, drivers };
}

function scoreHazard(dataset: Dataset, hubId: string, hazard: HazardType, yearCount: number) {
  const days = dataset.weather.get(hubId)?.days ?? [];
  const readings = readNriReadings(dataset, hubId, hazard);
  // Highest related FEMA score; a missing score counts as zero.
  const fema = Math.max(...readings.map((reading) => reading.score ?? 0));
  const weather = scoreWeather(days, hazard, yearCount);
  const score =
    weather.score === null ? fema : WEIGHTS.weather * weather.score + WEIGHTS.fema * fema;
  const rounded = round1(score);
  const output: HazardScore = {
    hazard,
    score: rounded,
    level: levelFor(rounded),
    weather:
      weather.score === null ? null : { score: round1(weather.score), drivers: weather.drivers },
    fema: { score: round1(fema), nri: readings },
  };
  return { score, output };
}

// Score each hazard, then average them. Keep raw scores for accurate ranking.
export function scoreHub(dataset: Dataset, hubId: string, yearCount: number): RawHubRisk {
  const rawScores = {} as Record<HazardType, number>;
  const hazards = HAZARDS.map((hazard) => {
    const result = scoreHazard(dataset, hubId, hazard, yearCount);
    rawScores[hazard] = result.score;
    return result.output;
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
