import { HazardTypeSchema, type HazardExposureResult, type HazardType } from '@hubcast/shared';
import { HAZARD_NRI } from '../config/scoring.js';
import type { Dataset } from '../data/load.js';
import { resolveHubIds } from './common.js';

export function createHazardExposureService(dataset: Dataset) {
  return {
    /** FEMA NRI source data per hub and hazard. `null` scores are kept as `null`. */
    getHazardExposure(
      hubIds: readonly string[],
      hazards?: readonly HazardType[],
    ): HazardExposureResult {
      const ids = resolveHubIds(dataset, hubIds);
      // Keep the canonical hazard order whatever order the caller used.
      const selected = HazardTypeSchema.options.filter(
        (hazard) => hazards === undefined || hazards.includes(hazard),
      );

      return {
        hubs: ids.map((hubId) => {
          const nri = dataset.hazards[hubId]?.hazards;
          return {
            hubId,
            hazards: selected.map((hazard) => ({
              hazard,
              nri: HAZARD_NRI[hazard].map((name) => {
                const reading = nri?.[name];
                return {
                  hazard: name,
                  score: reading?.score ?? null,
                  rating: reading?.rating ?? 'No Rating',
                };
              }),
            })),
          };
        }),
      };
    },
  };
}

export type HazardExposureService = ReturnType<typeof createHazardExposureService>;
