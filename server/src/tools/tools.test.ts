import {
  HazardExposureResultSchema,
  RiskScoresResultSchema,
  ToolMetaSchema,
  WeatherStatsResultSchema,
  buildHubIdSchema,
  toolResultSchema,
} from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadDataset } from '../data/dataset.js';
import { loadHubCatalog } from '../data/hubs.js';
import { createServices } from '../services/index.js';
import { createTools, type ToolHandler } from './tools.js';

const hubs = await loadHubCatalog();
const dataset = await loadDataset(hubs);
const services = createServices(hubs, dataset);
const tools = createTools({ services, meta: dataset.meta });

function tool(name: string): ToolHandler {
  const found = tools.find((t) => t.name === name);
  if (!found) throw new Error(`No tool ${name}`);
  return found;
}

describe('createTools', () => {
  it('has the 4 tools of DESIGN.md, each with a description', () => {
    expect(tools.map((t) => t.name)).toEqual([
      'list_hubs',
      'get_weather_stats',
      'get_hazard_exposure',
      'get_risk_scores',
    ]);
    for (const t of tools) expect(t.description.length, t.name).toBeGreaterThan(40);
  });

  it('only accepts hub IDs from the catalog', () => {
    const HubId = buildHubIdSchema(hubs.map((hub) => hub.id));
    const json = JSON.stringify(z.toJSONSchema(tool('get_weather_stats').schema));
    for (const hub of hubs)
      expect(HubId.safeParse(hub.id).success && json.includes(hub.id)).toBe(true);
  });
});

describe('list_hubs', () => {
  it('lists the hubs matching the filter', () => {
    const result = tool('list_hubs').run({ region: 'Northeast' });
    expect(result).toMatchObject({ ok: true, meta: { dataAsOf: null } });
    if (!result.ok) throw new Error('expected ok');
    expect((result.data as { hubs: { id: string }[] }).hubs.map((h) => h.id)).toEqual([
      'boston-ma',
      'newark-nj',
      'philadelphia-pa',
    ]);
  });

  it('lists all 19 hubs without a filter', () => {
    const result = tool('list_hubs').run({});
    if (!result.ok) throw new Error('expected ok');
    expect((result.data as { hubs: unknown[] }).hubs).toHaveLength(19);
  });
});

describe('get_weather_stats', () => {
  it('returns a valid envelope with the weather source and the data date', () => {
    const result = tool('get_weather_stats').run({ hubIds: ['denver-co'], year: 2025 });
    expect(toolResultSchema(WeatherStatsResultSchema).parse(result)).toEqual(result);
    expect(result).toMatchObject({
      ok: true,
      meta: { sources: [dataset.meta.weather.source], dataAsOf: dataset.meta.refreshedAt },
    });
  });

  it('returns OUT_OF_RANGE as a tool error, not an exception', () => {
    const result = tool('get_weather_stats').run({ hubIds: ['denver-co'], year: 1999 });
    expect(result).toMatchObject({ ok: false, error: { code: 'OUT_OF_RANGE' } });
    expect(JSON.stringify(result)).toContain('2023–2025');
  });
});

describe('get_hazard_exposure', () => {
  it('returns a valid envelope with the FEMA source', () => {
    const result = tool('get_hazard_exposure').run({
      hubIds: ['miami-fl'],
      hazards: ['hurricane'],
    });
    expect(toolResultSchema(HazardExposureResultSchema).parse(result)).toEqual(result);
    if (!result.ok) throw new Error('expected ok');
    expect(result.meta.sources[0]).toContain('FEMA National Risk Index');
  });
});

describe('get_risk_scores', () => {
  it('returns ranked scores from both data sources', () => {
    const result = tool('get_risk_scores').run({ sortBy: 'hurricane' });
    expect(toolResultSchema(RiskScoresResultSchema).parse(result)).toEqual(result);
    if (!result.ok) throw new Error('expected ok');
    expect(ToolMetaSchema.parse(result.meta).sources).toHaveLength(2);
    expect(result.data).toEqual(services.riskScores.getRiskScores(undefined, 'hurricane'));
  });
});

describe('invalid input', () => {
  it.each([
    ['unknown hub', 'get_weather_stats', { hubIds: ['springfield-il'] }],
    ['no hubs', 'get_hazard_exposure', { hubIds: [] }],
    ['unknown sortBy', 'get_risk_scores', { sortBy: 'earthquake' }],
    ['not an object', 'list_hubs', 'Boston'],
  ])('%s returns VALIDATION_ERROR with a readable message', (_label, name, input) => {
    const result = tool(name).run(input);
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    if (result.ok) throw new Error('expected failure');
    expect(result.error.message.length).toBeGreaterThan(0);
    expect(result.error.message).not.toContain('    at ');
  });

  it('names the unknown hub', () => {
    const result = tool('get_weather_stats').run({ hubIds: ['springfield-il'] });
    expect(JSON.stringify(result)).toContain('Unknown hub ID: springfield-il');
  });
});
