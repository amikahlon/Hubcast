import { z } from 'zod';

/** Daily weather for one hub. Units: °C, mm, cm, km/h. `null` means the source had no value. */
export const WeatherDaySchema = z.object({
  date: z.iso.date(),
  tempMax: z.number().nullable(),
  tempMin: z.number().nullable(),
  precipitation: z.number().min(0).nullable(),
  snowfall: z.number().min(0).nullable(),
  windGustMax: z.number().min(0).nullable(),
});
export type WeatherDay = z.infer<typeof WeatherDaySchema>;

/** `data/weather/<hubId>.json` */
export const WeatherFileSchema = z.object({
  hubId: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  days: z.array(WeatherDaySchema).min(1),
});
export type WeatherFile = z.infer<typeof WeatherFileSchema>;

/** FEMA NRI hazards used by the risk scoring (see DESIGN.md). */
export const NriHazardSchema = z.enum([
  'winterWeather',
  'iceStorm',
  'coldWave',
  'inlandFlooding',
  'coastalFlooding',
  'hurricane',
  'tornado',
  'strongWind',
  'hail',
  'heatWave',
  'wildfire',
]);
export type NriHazard = z.infer<typeof NriHazardSchema>;

export const NriHazardScoreSchema = z.object({
  /** Hazard Risk Index score, 0–100. `null` when NRI does not apply the hazard to the county. */
  score: z.number().min(0).max(100).nullable(),
  /** NRI rating, e.g. "Relatively High", "Not Applicable". */
  rating: z.string().min(1),
});
export type NriHazardScore = z.infer<typeof NriHazardScoreSchema>;

export const HubHazardsSchema = z.object({
  countyFips: z.string().regex(/^\d{5}$/),
  hazards: z.record(NriHazardSchema, NriHazardScoreSchema),
});
export type HubHazards = z.infer<typeof HubHazardsSchema>;

/** `data/hazards.json`: NRI county data keyed by hub ID. */
export const HazardsFileSchema = z.record(z.string().min(1), HubHazardsSchema);
export type HazardsFile = z.infer<typeof HazardsFileSchema>;

/** `data/meta.json` */
export const DataMetaSchema = z.object({
  refreshedAt: z.iso.date(),
  weather: z.object({
    source: z.string().min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }),
  hazards: z.object({
    source: z.string().min(1),
    /** NRI release, e.g. "December 2025". */
    version: z.string().min(1),
  }),
});
export type DataMeta = z.infer<typeof DataMetaSchema>;
