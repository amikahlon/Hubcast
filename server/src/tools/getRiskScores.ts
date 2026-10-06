import { defineTool, type ToolDeps } from './tool.js';

export function createGetRiskScoresTool({ services, meta, schemas }: ToolDeps) {
  return defineTool({
    name: 'get_risk_scores',
    description:
      'Ranked risk scores (0–100) and levels (low, moderate, high) for the given hubs, or all hubs ' +
      'if none are given, sorted by overall score or by one hazard. Each hazard score comes with ' +
      'its risk drivers: the weather metrics and FEMA scores behind it. Use it for rankings, ' +
      'comparisons and for explaining why a hub has a given risk. The rank is the position among ' +
      'the returned hubs only, so omit hubIds to rank against all hubs. The scores are ' +
      'calculated by the server and are judgment-based, not official.',
    schema: schemas.get_risk_scores,
    sources: [meta.weather.source, `${meta.hazards.source}, ${meta.hazards.version}`],
    dataAsOf: meta.refreshedAt,
    call: (input) => services.riskScores.getRiskScores(input.hubIds, input.sortBy),
  });
}
