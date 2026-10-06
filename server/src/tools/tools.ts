import {
  buildToolInputSchemas,
  type DataMeta,
  type ToolFailure,
  type ToolInputSchemas,
  type ToolName,
  type ToolResult,
} from '@hubcast/shared';
import type { z } from 'zod';
import { ServiceError } from '../services/errors.js';
import type { Services } from '../services/index.js';
import { formatIssues } from '../validation.js';

/** A tool as the agent sees it: a name, a description, an input schema and a thin `run`. */
export interface ToolHandler {
  name: ToolName;
  description: string;
  schema: z.ZodType;
  /** Validates the input, calls one service and returns `{ ok, data, meta }` or `{ ok: false, error }`. */
  run(input: unknown): ToolResult<unknown>;
}

export function failure(code: ToolFailure['error']['code'], message: string): ToolFailure {
  return { ok: false, error: { code, message } };
}

interface ToolDefinition<S extends z.ZodType> {
  name: ToolName;
  description: string;
  schema: S;
  sources: string[];
  dataAsOf: string | null;
  call: (input: z.output<S>) => unknown;
}

function defineTool<S extends z.ZodType>(definition: ToolDefinition<S>): ToolHandler {
  const { name, description, schema, sources, dataAsOf, call } = definition;
  return {
    name,
    description,
    schema,
    run(input) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) return failure('VALIDATION_ERROR', formatIssues(parsed.error));
      try {
        return { ok: true, data: call(parsed.data), meta: { sources, dataAsOf } };
      } catch (error) {
        if (error instanceof ServiceError) return failure(error.code, error.message);
        console.error(`Tool ${name} failed:`, error);
        return failure('INTERNAL_ERROR', 'The tool failed unexpectedly.');
      }
    },
  };
}

/** The 4 tools. Each one only validates its input and calls one deterministic service. */
export function createTools(deps: { services: Services; meta: DataMeta }): ToolHandler[] {
  const { services, meta } = deps;
  const schemas: ToolInputSchemas = buildToolInputSchemas(services.hubs.getHubIds());
  const weatherSource = meta.weather.source;
  const femaSource = `${meta.hazards.source}, ${meta.hazards.version}`;

  return [
    defineTool({
      name: 'list_hubs',
      description:
        'List the company hubs, optionally filtered by region (Northeast, Midwest, South, West) or ' +
        'two-letter state code. Use it to find hub IDs and to check whether a city is a company hub.',
      schema: schemas.list_hubs,
      sources: ['Company hub catalog'],
      dataAsOf: null,
      call: (input) => ({ hubs: services.hubs.listHubs(input) }),
    }),
    defineTool({
      name: 'get_weather_stats',
      description:
        'Number of days and percentage of days with heavy snow, freezing temperatures, heavy rain, ' +
        'high wind gusts, hot weather and any snowfall, for the given hubs. Pass a year for that ' +
        'calendar year, or omit it for the yearly average over all years in the data. The result ' +
        'includes the period covered and the rule behind each metric.',
      schema: schemas.get_weather_stats,
      sources: [weatherSource],
      dataAsOf: meta.refreshedAt,
      call: (input) => services.weatherStats.getWeatherStats(input.hubIds, input.year),
    }),
    defineTool({
      name: 'get_hazard_exposure',
      description:
        'FEMA National Risk Index source data (score 0–100 and rating, county level) per hazard for ' +
        'the given hubs. A null score means FEMA does not rate that hazard for the county. ' +
        'Hazards: winter, flood, hurricane, severeStorm, heat, wildfire.',
      schema: schemas.get_hazard_exposure,
      sources: [femaSource],
      dataAsOf: meta.refreshedAt,
      call: (input) => services.hazardExposure.getHazardExposure(input.hubIds, input.hazards),
    }),
    defineTool({
      name: 'get_risk_scores',
      description:
        'Ranked risk scores (0–100) and levels (low, moderate, high) for the given hubs, or all hubs ' +
        'if none are given, sorted by overall score or by one hazard. Each hazard score comes with ' +
        'its risk drivers: the weather metrics and FEMA scores behind it. Use it for rankings, ' +
        'comparisons and for explaining why a hub has a given risk. The rank is the position among ' +
        'the returned hubs only, so omit hubIds to rank against all hubs. The scores are ' +
        'calculated by the server and are judgment-based, not official.',
      schema: schemas.get_risk_scores,
      sources: [weatherSource, femaSource],
      dataAsOf: meta.refreshedAt,
      call: (input) => services.riskScores.getRiskScores(input.hubIds, input.sortBy),
    }),
  ];
}
