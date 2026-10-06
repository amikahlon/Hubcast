import {
  ApiErrorSchema,
  ChatResponseSchema,
  HubsResponseSchema,
  type ChatResponse,
  type Hub,
} from '@hubcast/shared';

/** Backend URL in production (Vercel build variable); locally the Vite proxy serves `/api`. */
const VITE_API_URL = import.meta.env.VITE_API_URL as string | undefined;
const API_URL = VITE_API_URL?.replace(/\/+$/, '') || '/api';

/** Claude can take 5–20 seconds; give up well after that. */
export const REQUEST_TIMEOUT_MS = 90_000;

const NETWORK_ERROR = 'Cannot reach the server. Check that it is running and try again.';
const TIMEOUT_ERROR = 'The assistant took too long to answer. Please try again.';
const INVALID_RESPONSE_ERROR = 'The server returned an unexpected response. Please try again.';

/** Fetches JSON. Every failure becomes an `Error` with a short message that is safe to show. */
async function requestJson(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    // The caller cancelled the request: let it handle that itself.
    if (signal?.aborted) throw error;
    throw new Error(timeout.aborted ? TIMEOUT_ERROR : NETWORK_ERROR, { cause: error });
  }

  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const apiError = ApiErrorSchema.safeParse(body);
    throw new Error(apiError.success ? apiError.data.error.message : INVALID_RESPONSE_ERROR);
  }
  if (body === undefined) throw new Error(INVALID_RESPONSE_ERROR);
  return body;
}

export async function sendChat(
  threadId: string,
  message: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const body = await requestJson(
    '/chat',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId, message }),
    },
    signal,
  );
  const result = ChatResponseSchema.safeParse(body);
  if (!result.success) throw new Error(INVALID_RESPONSE_ERROR);
  return result.data;
}

export async function fetchHubs(signal?: AbortSignal): Promise<Hub[]> {
  const body = await requestJson('/hubs', {}, signal);
  const result = HubsResponseSchema.safeParse(body);
  if (!result.success) throw new Error(INVALID_RESPONSE_ERROR);
  return result.data.hubs;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : INVALID_RESPONSE_ERROR;
}
