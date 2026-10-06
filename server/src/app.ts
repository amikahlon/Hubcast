import cors from 'cors';
import express, { type Express } from 'express';
import type { ChatService } from './agent/chat.js';
import { chatRouter } from './routes/chat.js';
import { healthRouter } from './routes/health.js';
import { hubsRouter } from './routes/hubs.js';
import { errorHandler, notFoundHandler } from './routes/http.js';
import type { HubsService } from './services/hubs.js';

export interface AppDeps {
  hubsService: HubsService;
  chatService: ChatService;
  /** Date of the last data refresh; null until `npm run refresh-data` has run (Phase 2). */
  dataAsOf: string | null;
  corsOrigin: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  // Railway puts one proxy in front of the server; trust it so the rate limit sees the real client IP.
  app.set('trust proxy', 1);
  app.use(cors({ origin: deps.corsOrigin }));
  app.use(express.json({ limit: '10kb' }));

  app.use(healthRouter(deps));
  app.use(hubsRouter(deps));
  app.use(chatRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
