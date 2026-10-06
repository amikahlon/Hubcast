import {
  NriHazardSchema,
  type HazardsFile,
  type Hub,
  type NriHazard,
  type NriHazardScore,
} from '@hubcast/shared';
import { z } from 'zod';
import { fetchJson } from './http.js';

export const NRI_SOURCE = 'FEMA National Risk Index (county level)';

// Official FEMA feature layer (ArcGIS org "FEMA AGOL", owner FEMA_NationalRiskIndex).
const ENDPOINT =
  'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query';

/** NRI field prefix per hazard: `<prefix>_RISKS` is the 0–100 score, `<prefix>_RISKR` the rating. */
const FIELD_PREFIX: Record<NriHazard, string> = {
  winterWeather: 'WNTW',
  iceStorm: 'ISTM',
  coldWave: 'CWAV',
  inlandFlooding: 'IFLD',
  coastalFlooding: 'CFLD',
  hurricane: 'HRCN',
  tornado: 'TRND',
  strongWind: 'SWND',
  hail: 'HAIL',
  heatWave: 'HWAV',
  wildfire: 'WFIR',
};

const HAZARDS = NriHazardSchema.options;

const OUT_FIELDS = [
  'STCOFIPS',
  'NRI_VER',
  ...HAZARDS.flatMap((hazard) => [
    `${FIELD_PREFIX[hazard]}_RISKS`,
    `${FIELD_PREFIX[hazard]}_RISKR`,
  ]),
];

const ResponseSchema = z.object({
  features: z.array(z.object({ attributes: z.record(z.string(), z.unknown()) })),
});
const CountySchema = z.object({ STCOFIPS: z.string(), NRI_VER: z.string() });

function readHazard(attributes: Record<string, unknown>, hazard: NriHazard): NriHazardScore {
  const prefix = FIELD_PREFIX[hazard];
  const score = z.number().nullable().safeParse(attributes[`${prefix}_RISKS`]);
  const rating = z.string().min(1).safeParse(attributes[`${prefix}_RISKR`]);
  if (!score.success || !rating.success) {
    throw new Error(`${hazard} (${prefix}_RISKS / ${prefix}_RISKR) is missing or malformed`);
  }
  return { score: score.data, rating: rating.data };
}

/** Converts the NRI response into hazards keyed by hub ID. Every hub county must be present. */
export function toHazardsFile(
  hubs: readonly Hub[],
  raw: unknown,
): { hazards: HazardsFile; version: string } {
  const body = ResponseSchema.safeParse(raw);
  if (!body.success) {
    throw new Error(`Invalid NRI response: ${JSON.stringify(raw).slice(0, 300)}`);
  }

  const byFips = new Map<string, Record<string, unknown>>();
  const versions = new Set<string>();
  for (const { attributes } of body.data.features) {
    const county = CountySchema.parse(attributes);
    byFips.set(county.STCOFIPS, attributes);
    versions.add(county.NRI_VER);
  }
  const [version, ...otherVersions] = versions;
  if (version === undefined || otherVersions.length > 0) {
    throw new Error(`Expected one NRI version, got: ${[...versions].join(', ') || 'none'}`);
  }

  const hazards: HazardsFile = {};
  for (const hub of hubs) {
    const attributes = byFips.get(hub.countyFips);
    if (!attributes) {
      throw new Error(`NRI has no data for ${hub.id} (county FIPS ${hub.countyFips})`);
    }
    try {
      hazards[hub.id] = {
        countyFips: hub.countyFips,
        hazards: Object.fromEntries(
          HAZARDS.map((hazard) => [hazard, readHazard(attributes, hazard)]),
        ) as Record<NriHazard, NriHazardScore>,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid NRI data for ${hub.id}: ${reason}`, { cause: error });
    }
  }
  return { hazards, version };
}

export async function fetchHazards(
  hubs: readonly Hub[],
): Promise<{ hazards: HazardsFile; version: string }> {
  const fipsList = hubs.map((hub) => `'${hub.countyFips}'`).join(',');
  const url = new URL(ENDPOINT);
  url.searchParams.set('where', `STCOFIPS IN (${fipsList})`);
  url.searchParams.set('outFields', OUT_FIELDS.join(','));
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'json');
  return toHazardsFile(hubs, await fetchJson(url));
}
