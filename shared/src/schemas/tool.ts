import { z } from 'zod';

export const ToolErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'OUT_OF_RANGE',
  'INTERNAL_ERROR',
]);
export type ToolErrorCode = z.infer<typeof ToolErrorCodeSchema>;

export const ToolErrorSchema = z.object({
  code: ToolErrorCodeSchema,
  message: z.string().min(1),
});
export type ToolError = z.infer<typeof ToolErrorSchema>;

export const ToolMetaSchema = z.object({
  /** Data sources behind the result, e.g. "Open-Meteo", "FEMA NRI". */
  sources: z.array(z.string().min(1)),
  /** Date the underlying data was refreshed (YYYY-MM-DD), if any. */
  dataAsOf: z.iso.date().nullable(),
});
export type ToolMeta = z.infer<typeof ToolMetaSchema>;

export const ToolFailureSchema = z.object({
  ok: z.literal(false),
  error: ToolErrorSchema,
});
export type ToolFailure = z.infer<typeof ToolFailureSchema>;

/** Envelope every tool returns: `{ ok, data, meta }` or `{ ok: false, error }`. */
export function toolResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data, meta: ToolMetaSchema }),
    ToolFailureSchema,
  ]);
}

export type ToolResult<T> = { ok: true; data: T; meta: ToolMeta } | ToolFailure;
