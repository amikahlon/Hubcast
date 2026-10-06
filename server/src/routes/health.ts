import { HealthResponseSchema } from '@hubcast/shared';
import { Router } from 'express';
import type { HubsService } from '../services/hubs.js';
import { sendValidated } from './validation.js';

export function healthRouter(deps: { hubsService: HubsService; dataAsOf: string | null }): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    sendValidated(res, HealthResponseSchema, {
      status: 'ok',
      hubCount: deps.hubsService.getHubIds().length,
      dataAsOf: deps.dataAsOf,
    });
  });
  return router;
}
