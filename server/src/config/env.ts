import { z } from 'zod';

/** Treats empty strings (e.g. `ANTHROPIC_API_KEY=`) as unset. */
const requiredString = (name: string) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string({ error: `${name} is required` }).min(1),
  );

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  /** The one browser origin allowed to call the API (the Vercel URL in production). */
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  ANTHROPIC_API_KEY: requiredString('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL: requiredString('ANTHROPIC_MODEL'),
});
export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment (see .env.example):\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
