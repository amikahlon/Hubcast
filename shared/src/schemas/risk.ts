import { z } from 'zod';
import { HazardTypeSchema, RiskLevelSchema } from './common.js';
import { NriHazardSchema, NriHazardScoreSchema } from './data.js';

export const WeatherMetricSchema = z.enum([
  'heavySnow',
  'freezing',
  'heavyRain',
  'highWind',
  'hot',
  'snowfallDays',
]);
export type WeatherMetric = z.infer<typeof WeatherMetricSchema>;

/** One FEMA NRI hazard reading. `score` is `null` when NRI does not apply the hazard. */
export const NriReadingSchema = NriHazardScoreSchema.extend({ hazard: NriHazardSchema });
export type NriReading = z.infer<typeof NriReadingSchema>;

// --- Weather stats ---

/** Raw weather values a get_weather_stats result can be sorted by. */
export const WeatherValueSchema = z.enum([
  'totalSnowfallCm',
  'totalPrecipitationMm',
  'maxSnowfallCm',
  'maxPrecipitationMm',
  'maxWindGustKmh',
  'highestTempC',
  'lowestTempC',
]);
export type WeatherValue = z.infer<typeof WeatherValueSchema>;

export const WeatherStatsResultSchema = z.object({
  /** Value the hubs are sorted by (`lowestTempC` ascending, others descending), or `null`. */
  sortBy: WeatherValueSchema.nullable(),
  period: z.object({
    /** `year`: one calendar year. `yearlyAverage`: average per year over all years. */
    kind: z.enum(['year', 'yearlyAverage']),
    startYear: z.number().int(),
    endYear: z.number().int(),
    /** Plain-text description of the period and how to read the values. */
    description: z.string(),
  }),
  hubs: z.array(
    z.object({
      hubId: z.string(),
      /** Position when sorted by `sortBy`, starting at 1; `null` when not sorted. */
      rank: z.number().int().positive().nullable(),
      /**
       * Raw weather values, not risk scores. Totals are per year when `period.kind` is
       * `yearlyAverage`; highest and lowest values are over the whole period.
       * `null` only when the period has no data for the value.
       */
      values: z.object({
        totalSnowfallCm: z.number().min(0).nullable(),
        totalPrecipitationMm: z.number().min(0).nullable(),
        maxSnowfallCm: z.number().min(0).nullable(),
        maxPrecipitationMm: z.number().min(0).nullable(),
        maxWindGustKmh: z.number().min(0).nullable(),
        highestTempC: z.number().nullable(),
        lowestTempC: z.number().nullable(),
      }),
      metrics: z.array(
        z.object({
          metric: WeatherMetricSchema,
          label: z.string(),
          /** What counts as a day for this metric, e.g. "daily snowfall ≥ 5 cm". */
          definition: z.string(),
          /** Number of days (per year when `period.kind` is `yearlyAverage`). */
          days: z.number().min(0),
          /** Share of days with a value that match, 0–100. */
          percentage: z.number().min(0).max(100),
        }),
      ),
    }),
  ),
});
export type WeatherStatsResult = z.infer<typeof WeatherStatsResultSchema>;
export type WeatherValues = WeatherStatsResult['hubs'][number]['values'];

// --- Hazard exposure ---

export const HazardExposureResultSchema = z.object({
  hubs: z.array(
    z.object({
      hubId: z.string(),
      hazards: z.array(z.object({ hazard: HazardTypeSchema, nri: z.array(NriReadingSchema) })),
    }),
  ),
});
export type HazardExposureResult = z.infer<typeof HazardExposureResultSchema>;

// --- Risk scores ---

export const RiskSortBySchema = z.enum(['overall', ...HazardTypeSchema.options]);
export type RiskSortBy = z.infer<typeof RiskSortBySchema>;

export const WeatherDriverSchema = z.object({
  metric: WeatherMetricSchema,
  label: z.string(),
  definition: z.string(),
  daysPerYear: z.number().min(0),
  /** Days per year at which the metric scores 100. */
  cap: z.number().positive(),
  /** `min(daysPerYear / cap, 1) × 100` */
  score: z.number().min(0).max(100),
});
export type WeatherDriver = z.infer<typeof WeatherDriverSchema>;

export const HazardScoreSchema = z.object({
  hazard: HazardTypeSchema,
  score: z.number().min(0).max(100),
  level: RiskLevelSchema,
  /** `null` for hazards without weather metrics (hurricane, wildfire). */
  weather: z
    .object({ score: z.number().min(0).max(100), drivers: z.array(WeatherDriverSchema) })
    .nullable(),
  /** Highest related NRI score (a `null` NRI score counts as 0). */
  fema: z.object({ score: z.number().min(0).max(100), nri: z.array(NriReadingSchema) }),
});
export type HazardScore = z.infer<typeof HazardScoreSchema>;

export const HubRiskSchema = z.object({
  hubId: z.string(),
  /** Position when sorted by `sortBy`, starting at 1. */
  rank: z.number().int().positive(),
  overall: z.object({ score: z.number().min(0).max(100), level: RiskLevelSchema }),
  hazards: z.array(HazardScoreSchema),
});
export type HubRisk = z.infer<typeof HubRiskSchema>;

export const RiskScoresResultSchema = z.object({
  sortBy: RiskSortBySchema,
  hubs: z.array(HubRiskSchema),
});
export type RiskScoresResult = z.infer<typeof RiskScoresResultSchema>;
