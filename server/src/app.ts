import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { healthRouter } from './routes/health.js';
import { hubsRouter } from './routes/hubs.js';
import type { HubsService } from './services/hubs.js';

export interface AppDeps {
  hubsService: HubsService;
  /** Date of the last data refresh; null until `npm run refresh-data` has run (Phase 2). */
  dataAsOf: string | null;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.use(healthRouter(deps));
  app.use(hubsRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
