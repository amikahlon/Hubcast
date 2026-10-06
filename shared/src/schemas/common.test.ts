import { describe, expect, it } from 'vitest';
import {
  HazardTypeSchema,
  RegionSchema,
  RiskLevelSchema,
  STATE_REGIONS,
  StateCodeSchema,
  regionForState,
} from './common.js';

describe('enums', () => {
  it('accepts known values', () => {
    expect(RegionSchema.parse('Midwest')).toBe('Midwest');
    expect(HazardTypeSchema.parse('severeStorm')).toBe('severeStorm');
    expect(RiskLevelSchema.parse('moderate')).toBe('moderate');
  });

  it('rejects unknown values', () => {
    expect(RegionSchema.safeParse('midwest').success).toBe(false);
    expect(HazardTypeSchema.safeParse('earthquake').success).toBe(false);
    expect(RiskLevelSchema.safeParse('extreme').success).toBe(false);
  });

  it('has six hazards', () => {
    expect(HazardTypeSchema.options).toHaveLength(6);
  });
});

describe('StateCodeSchema', () => {
  it('normalises case and whitespace', () => {
    expect(StateCodeSchema.parse(' tx ')).toBe('TX');
  });

  it('rejects unknown codes', () => {
    expect(StateCodeSchema.safeParse('XX').success).toBe(false);
    expect(StateCodeSchema.safeParse('Texas').success).toBe(false);
  });
});

describe('regionForState', () => {
  it('covers the 50 states and DC', () => {
    expect(Object.keys(STATE_REGIONS)).toHaveLength(51);
  });

  it('uses Census regions', () => {
    expect(regionForState('MO')).toBe('Midwest');
    expect(regionForState('TX')).toBe('South');
    expect(regionForState('NJ')).toBe('Northeast');
    expect(regionForState('UT')).toBe('West');
  });
});
