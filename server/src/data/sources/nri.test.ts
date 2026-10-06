import { HazardsFileSchema, NriHazardSchema, type Hub } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { toHazardsFile } from './nri.js';

function hub(id: string, countyFips: string): Hub {
  return {
    id,
    name: id,
    city: id,
    state: 'TX',
    region: 'South',
    lat: 0,
    lon: 0,
    countyFips,
    countyName: 'Test County',
  };
}

const PREFIXES = [
  'WNTW',
  'ISTM',
  'CWAV',
  'IFLD',
  'CFLD',
  'HRCN',
  'TRND',
  'SWND',
  'HAIL',
  'HWAV',
  'WFIR',
];

function county(fips: string, overrides: Record<string, unknown> = {}, version = 'December 2025') {
  const attributes: Record<string, unknown> = { STCOFIPS: fips, NRI_VER: version };
  for (const prefix of PREFIXES) {
    attributes[`${prefix}_RISKS`] = 50;
    attributes[`${prefix}_RISKR`] = 'Relatively Moderate';
  }
  return { attributes: { ...attributes, ...overrides } };
}

const hubs = [hub('houston-tx', '48201'), hub('dallas-tx', '48113')];

describe('toHazardsFile', () => {
  it('converts scores and ratings per hub, including null scores', () => {
    const raw = {
      features: [
        county('48113', { CFLD_RISKS: null, CFLD_RISKR: 'Not Applicable' }),
        county('48201', {
          HRCN_RISKS: 97.5,
          HRCN_RISKR: 'Very High',
          WNTW_RISKS: 0,
          WNTW_RISKR: 'No Rating',
        }),
      ],
    };
    const { hazards, version } = toHazardsFile(hubs, raw);

    expect(version).toBe('December 2025');
    expect(Object.keys(hazards)).toEqual(['houston-tx', 'dallas-tx']);
    expect(hazards['houston-tx']?.countyFips).toBe('48201');
    expect(hazards['houston-tx']?.hazards.hurricane).toEqual({ score: 97.5, rating: 'Very High' });
    expect(hazards['houston-tx']?.hazards.winterWeather).toEqual({ score: 0, rating: 'No Rating' });
    expect(hazards['dallas-tx']?.hazards.coastalFlooding).toEqual({
      score: null,
      rating: 'Not Applicable',
    });
    expect(hazards['dallas-tx']?.hazards.wildfire.score).toBe(50);
    // Output matches the file schema and covers all 11 hazards.
    expect(HazardsFileSchema.safeParse(hazards).success).toBe(true);
    expect(Object.keys(hazards['dallas-tx']?.hazards ?? {})).toHaveLength(
      NriHazardSchema.options.length,
    );
  });

  it('fails when a hub county is missing from the response', () => {
    expect(() => toHazardsFile(hubs, { features: [county('48201')] })).toThrow(
      /dallas-tx \(county FIPS 48113\)/,
    );
  });

  it('fails when a hazard field is missing', () => {
    const { attributes } = county('48113');
    delete attributes['HAIL_RISKS'];
    expect(() => toHazardsFile(hubs, { features: [county('48201'), { attributes }] })).toThrow(
      /dallas-tx.*hail/,
    );
  });

  it('fails on a non-numeric score', () => {
    const raw = { features: [county('48201'), county('48113', { HWAV_RISKS: 'high' })] };
    expect(() => toHazardsFile(hubs, raw)).toThrow(/heatWave/);
  });

  it('fails when the response mixes NRI versions', () => {
    const raw = { features: [county('48201'), county('48113', {}, 'March 2023')] };
    expect(() => toHazardsFile(hubs, raw)).toThrow(/one NRI version/);
  });

  it('fails on an ArcGIS error body', () => {
    expect(() => toHazardsFile(hubs, { error: { code: 400, message: 'Invalid query' } })).toThrow(
      /Invalid NRI response/,
    );
  });
});
