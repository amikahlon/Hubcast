import { HazardTypeSchema, type HazardExposureResult, type HazardType } from '@hubcast/shared';
import type { Dataset } from '../data/load.js';
import { readNriReadings, resolveHubIds } from './common.js';

export function createHazardExposureService(dataset: Dataset) {
  return {
    /** FEMA NRI source data per hub and hazard. `null` scores are kept as `null`. */
    getHazardExposure(
      hubIds: readonly string[],
      hazards?: readonly HazardType[],
    ): HazardExposureResult {
      const ids = resolveHubIds(dataset, hubIds);
      // Keep the canonical hazard order whatever order the caller used.
      const selectedHazards = HazardTypeSchema.options.filter(
        (hazard) => hazards === undefined || hazards.includes(hazard),
      );

      return {
        hubs: ids.map((hubId) => ({
          hubId,
          hazards: selectedHazards.map((hazard) => ({
            hazard,
            nri: readNriReadings(dataset, hubId, hazard),
          })),
        })),
      };
    },
  };
}

export type HazardExposureService = ReturnType<typeof createHazardExposureService>;
