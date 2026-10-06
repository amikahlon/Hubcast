import { z } from 'zod';

export const RegionSchema = z.enum(['Northeast', 'Midwest', 'South', 'West']);
export type Region = z.infer<typeof RegionSchema>;

export const HazardTypeSchema = z.enum([
  'winter',
  'flood',
  'hurricane',
  'severeStorm',
  'heat',
  'wildfire',
]);
export type HazardType = z.infer<typeof HazardTypeSchema>;

export const RiskLevelSchema = z.enum(['low', 'moderate', 'high']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** US Census Bureau regions for the 50 states and DC. */
export const STATE_REGIONS = {
  CT: 'Northeast',
  ME: 'Northeast',
  MA: 'Northeast',
  NH: 'Northeast',
  RI: 'Northeast',
  VT: 'Northeast',
  NJ: 'Northeast',
  NY: 'Northeast',
  PA: 'Northeast',
  IL: 'Midwest',
  IN: 'Midwest',
  MI: 'Midwest',
  OH: 'Midwest',
  WI: 'Midwest',
  IA: 'Midwest',
  KS: 'Midwest',
  MN: 'Midwest',
  MO: 'Midwest',
  NE: 'Midwest',
  ND: 'Midwest',
  SD: 'Midwest',
  DE: 'South',
  DC: 'South',
  FL: 'South',
  GA: 'South',
  MD: 'South',
  NC: 'South',
  SC: 'South',
  VA: 'South',
  WV: 'South',
  AL: 'South',
  KY: 'South',
  MS: 'South',
  TN: 'South',
  AR: 'South',
  LA: 'South',
  OK: 'South',
  TX: 'South',
  AZ: 'West',
  CO: 'West',
  ID: 'West',
  MT: 'West',
  NV: 'West',
  NM: 'West',
  UT: 'West',
  WY: 'West',
  AK: 'West',
  CA: 'West',
  HI: 'West',
  OR: 'West',
  WA: 'West',
} as const satisfies Record<string, Region>;

export type StateCode = keyof typeof STATE_REGIONS;

const STATE_CODES = Object.keys(STATE_REGIONS) as [StateCode, ...StateCode[]];

/** Two-letter state code. Lowercase input is accepted and upper-cased. */
export const StateCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(STATE_CODES, { error: 'Unknown US state code' }));

export function regionForState(state: StateCode): Region {
  return STATE_REGIONS[state];
}
