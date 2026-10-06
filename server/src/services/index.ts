import type { Hub } from '@hubcast/shared';
import type { Dataset } from '../data/dataset.js';
import { createHazardExposureService } from './hazardExposure.js';
import { createHubsService } from './hubs.js';
import { createRiskScoresService } from './riskScores.js';
import { createWeatherStatsService } from './weatherStats.js';

export function createServices(hubs: readonly Hub[], dataset: Dataset) {
  return {
    hubs: createHubsService(hubs),
    weatherStats: createWeatherStatsService(dataset),
    hazardExposure: createHazardExposureService(dataset),
    riskScores: createRiskScoresService(dataset),
  };
}

export type Services = ReturnType<typeof createServices>;
