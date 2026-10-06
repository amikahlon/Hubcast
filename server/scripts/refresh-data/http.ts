const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3_000;
/** Open-Meteo's rate limit is per minute ("please try again in one minute"). */
const RATE_LIMIT_DELAY_MS = 65_000;

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    url: URL,
  ) {
    super(`HTTP ${status} from ${url.origin}${url.pathname}`);
  }
}

/** GETs JSON, retrying on network errors, 429 and 5xx. */
export async function fetchJson(url: URL): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    let delay = RETRY_DELAY_MS;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return await res.json();
      throw new HttpStatusError(res.status, url);
    } catch (error) {
      const status = error instanceof HttpStatusError ? error.status : undefined;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
      if (status === 429) delay = RATE_LIMIT_DELAY_MS;
      console.warn(`  ${(error as Error).message}; retrying in ${delay / 1000}s`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
