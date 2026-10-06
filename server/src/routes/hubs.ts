import { HubsQuerySchema, HubsResponseSchema } from '@hubcast/shared';
import { Router } from 'express';
import type { HubsService } from '../services/hubs.js';
import { parseRequest, sendValidated } from './validation.js';

export function hubsRouter(deps: { hubsService: HubsService }): Router {
  const router = Router();
  router.get('/hubs', (req, res) => {
    const query = parseRequest(HubsQuerySchema, req.query);
    sendValidated(res, HubsResponseSchema, { hubs: deps.hubsService.listHubs(query) });
  });
  return router;
}
