import { buildToolInputSchemas, type DataMeta } from '@hubcast/shared';
import type { Services } from '../services/index.js';
import { createGetHazardExposureTool } from './getHazardExposure.js';
import { createGetRiskScoresTool } from './getRiskScores.js';
import { createGetWeatherStatsTool } from './getWeatherStats.js';
import { createListHubsTool } from './listHubs.js';
import type { ToolHandler } from './tool.js';

export { failure, type ToolHandler } from './tool.js';

// The agent's tool registry. Input schemas allow only IDs from the hub catalog.
export function createTools(deps: { services: Services; meta: DataMeta }): ToolHandler[] {
  const schemas = buildToolInputSchemas(deps.services.hubs.getHubIds());
  const toolDeps = { ...deps, schemas };

  return [
    createListHubsTool(toolDeps),
    createGetWeatherStatsTool(toolDeps),
    createGetHazardExposureTool(toolDeps),
    createGetRiskScoresTool(toolDeps),
  ];
}
