import { z } from 'zod';
import { RegionSchema, StateCodeSchema, regionForState } from './common.js';

export const HubSchema = z
  .object({
    id: z.string().regex(/^[a-z]+(-[a-z]+)*$/, 'Hub ID must be lowercase kebab-case'),
    name: z.string().min(1),
    city: z.string().min(1),
    state: StateCodeSchema,
    region: RegionSchema,
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    countyFips: z.string().regex(/^\d{5}$/, 'County FIPS must be 5 digits'),
    countyName: z.string().min(1),
  })
  .refine((hub) => hub.region === regionForState(hub.state), {
    message: 'Region does not match state',
    path: ['region'],
  });
export type Hub = z.infer<typeof HubSchema>;

export const HubCatalogSchema = z
  .array(HubSchema)
  .min(1)
  .refine((hubs) => new Set(hubs.map((hub) => hub.id)).size === hubs.length, {
    message: 'Hub IDs must be unique',
  });

/** Builds a schema that only accepts hub IDs from the catalog. */
export function buildHubIdSchema(ids: readonly string[]) {
  const [first, ...rest] = ids;
  if (first === undefined) {
    throw new Error('Cannot build a hub ID schema from an empty catalog');
  }
  return z.enum([first, ...rest], {
    error: (issue) => `Unknown hub ID: ${String(issue.input)}`,
  });
}
