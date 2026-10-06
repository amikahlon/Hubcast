import { defineTool, type ToolDeps } from './tool.js';

export function createGetHazardExposureTool({ services, meta, schemas }: ToolDeps) {
  return defineTool({
    name: 'get_hazard_exposure',
    description:
      'FEMA National Risk Index source data (score 0–100 and rating, county level) per hazard for ' +
      'the given hubs. A null score means FEMA does not rate that hazard for the county. ' +
      'Hazards: winter, flood, hurricane, severeStorm, heat, wildfire.',
    schema: schemas.get_hazard_exposure,
    sources: [`${meta.hazards.source}, ${meta.hazards.version}`],
    dataAsOf: meta.refreshedAt,
    call: (input) => services.hazardExposure.getHazardExposure(input.hubIds, input.hazards),
  });
}
