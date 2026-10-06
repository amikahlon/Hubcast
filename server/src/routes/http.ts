import type { ApiError, ApiErrorCode } from '@hubcast/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { formatIssues } from '../utils.js';

/** An error that becomes an HTTP response in the `ApiError` format. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Parses request input, turning Zod errors into a 400 `VALIDATION_ERROR`. */
export function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', formatIssues(result.error));
  }
  return result.data;
}

/** Validates a response body before sending. A mismatch is a server bug (500). */
export function sendValidated<T extends z.ZodType>(
  res: Response,
  schema: T,
  body: z.input<T>,
): void {
  res.json(schema.parse(body));
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

/** Malformed JSON bodies are rejected by express.json() with this error type. */
function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (isJsonParseError(err)) return new HttpError(400, 'VALIDATION_ERROR', 'Invalid JSON body');
  return new HttpError(500, 'INTERNAL_ERROR', 'Internal server error');
}

/** Last middleware: every error leaves the API as `{ error: { code, message } }`. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpError = toHttpError(err);
  if (httpError.status >= 500) console.error(err);
  const body: ApiError = { error: { code: httpError.code, message: httpError.message } };
  res.status(httpError.status).json(body);
};
