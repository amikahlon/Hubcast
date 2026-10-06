import type { HealthResponse } from '@hubcast/shared';
import { useEffect, useState } from 'react';
import { fetchHealth } from './api.js';

type Status =
  { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error'; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((health) => setStatus({ kind: 'ok', health }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <h1>Hubcast</h1>
      <p className="subtitle">Weather risk assistant for 19 logistics hubs</p>

      <section className="card" aria-live="polite">
        <h2>Server status</h2>
        {status.kind === 'loading' && <p>Checking…</p>}
        {status.kind === 'error' && (
          <p className="status status-error">Unavailable: {status.message}</p>
        )}
        {status.kind === 'ok' && (
          <dl>
            <dt>Status</dt>
            <dd className="status status-ok">{status.health.status}</dd>
            <dt>Hubs</dt>
            <dd>{status.health.hubCount}</dd>
            <dt>Data as of</dt>
            <dd>{status.health.dataAsOf ?? 'not refreshed yet'}</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
