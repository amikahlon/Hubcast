import type { ToolErrorCode } from '@hubcast/shared';
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
