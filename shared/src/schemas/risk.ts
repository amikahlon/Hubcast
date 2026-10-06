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

export const WeatherStatsResultSchema = z.object({
  period: z.object({
    /** `year`: one calendar year. `yearlyAverage`: average per year over all years. */
    kind: z.enum(['year', 'yearlyAverage']),
    startYear: z.number().int(),
    endYear: z.number().int(),
  }),
  hubs: z.array(
    z.object({
      hubId: z.string(),
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
