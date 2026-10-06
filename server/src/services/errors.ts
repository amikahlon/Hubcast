import type { ToolErrorCode } from '@hubcast/shared';

/** Error with a code that the tools (Phase 4) turn into `{ ok: false, error }`. */
export class ServiceError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
