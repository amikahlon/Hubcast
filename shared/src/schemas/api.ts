import { z } from 'zod';
import { RegionSchema, StateCodeSchema } from './common.js';
import { HubSchema } from './hub.js';

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'AGENT_ERROR',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HubsQuerySchema = z.strictObject({
  region: RegionSchema.optional(),
  state: StateCodeSchema.optional(),
});
export type HubsQuery = z.infer<typeof HubsQuerySchema>;

export const HubsResponseSchema = z.object({
  hubs: z.array(HubSchema),
});
export type HubsResponse = z.infer<typeof HubsResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  hubCount: z.number().int().nonnegative(),
  /** Date the weather and FEMA data was refreshed, or null before the first refresh. */
  dataAsOf: z.iso.date().nullable(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
