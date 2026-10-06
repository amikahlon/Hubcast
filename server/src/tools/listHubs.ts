import { defineTool, type ToolDeps } from './tool.js';

export function createListHubsTool({ services, schemas }: ToolDeps) {
  return defineTool({
    name: 'list_hubs',
    description:
      'List the company hubs, optionally filtered by region (Northeast, Midwest, South, West) or ' +
      'two-letter state code. Use it to find hub IDs and to check whether a city is a company hub.',
    schema: schemas.list_hubs,
    sources: ['Company hub catalog'],
    dataAsOf: null,
    call: (input) => ({ hubs: services.hubs.listHubs(input) }),
  });
}
