import { ApiErrorSchema, HealthResponseSchema, type HealthResponse } from '@hubcast/shared';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = ApiErrorSchema.safeParse(body);
    throw new Error(error.success ? error.data.error.message : `Server returned ${res.status}`);
  }
  return HealthResponseSchema.parse(body);
}
