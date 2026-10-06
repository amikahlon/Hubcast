import { z } from 'zod';

/** Treats empty strings (e.g. `ANTHROPIC_API_KEY=`) as unset. */
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  // Not used until the agent exists (Phase 4).
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: optionalString,
});
export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
