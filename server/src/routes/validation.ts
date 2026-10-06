import type { Response } from 'express';
import type { z } from 'zod';
import { HttpError } from '../middleware/errors.js';

/** Parses request input, turning Zod errors into a 400 `VALIDATION_ERROR`. */
export function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    throw new HttpError(400, 'VALIDATION_ERROR', message);
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
