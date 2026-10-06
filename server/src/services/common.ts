import type { HazardType, NriReading, ToolErrorCode } from '@hubcast/shared';
import { HAZARD_NRI } from '../config/scoring.js';
import type { Dataset } from '../data/load.js';

/** Error with a code that the tools turn into `{ ok: false, error }` for the agent. */
export class ServiceError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Source readings shared by hazard exposure and risk scoring. */
export function readNriReadings(dataset: Dataset, hubId: string, hazard: HazardType): NriReading[] {
  const readings = dataset.hazards[hubId]?.hazards;
  return HAZARD_NRI[hazard].map((name) => ({
    hazard: name,
    score: readings?.[name]?.score ?? null,
    rating: readings?.[name]?.rating ?? 'No Rating',
  }));
}

/** Hub IDs without duplicates, in input order. Throws `NOT_FOUND` for an ID outside the dataset. */
export function resolveHubIds(dataset: Dataset, hubIds: readonly string[]): string[] {
  const unique = [...new Set(hubIds)];
  for (const hubId of unique) {
    if (!dataset.weather.has(hubId) || dataset.hazards[hubId] === undefined) {
      throw new ServiceError('NOT_FOUND', `Unknown hub ID: ${hubId}`);
    }
  }
  return unique;
}
