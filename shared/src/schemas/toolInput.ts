import { z } from 'zod';
import { HazardTypeSchema, RegionSchema, StateCodeSchema } from './common.js';
import { buildHubIdSchema } from './hub.js';
import { RiskSortBySchema } from './risk.js';

/** Input schemas for the 4 tools. Hub IDs are restricted to the company hub catalog. */
export function buildToolInputSchemas(hubIds: readonly string[]) {
  const HubId = buildHubIdSchema(hubIds);

  return {
    list_hubs: z.object({
      region: RegionSchema.optional(),
      state: StateCodeSchema.optional(),
    }),
    get_weather_stats: z.object({
      hubIds: z.array(HubId).min(1),
      year: z.number().int().optional(),
    }),
    get_hazard_exposure: z.object({
      hubIds: z.array(HubId).min(1),
      hazards: z.array(HazardTypeSchema).min(1).optional(),
    }),
    get_risk_scores: z.object({
      hubIds: z.array(HubId).min(1).optional(),
      sortBy: RiskSortBySchema.optional(),
    }),
  };
}

export type ToolInputSchemas = ReturnType<typeof buildToolInputSchemas>;
export type ToolName = keyof ToolInputSchemas;
