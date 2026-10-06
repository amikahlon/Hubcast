import { describe, expect, it } from 'vitest';
import { HubCatalogSchema, HubSchema, buildHubIdSchema } from './hub.js';

const validHub = {
  id: 'kansas-city-mo',
  name: 'Kansas City Hub',
  city: 'Kansas City',
  state: 'MO',
  region: 'Midwest',
  lat: 39.0997,
  lon: -94.5786,
  countyFips: '29095',
  countyName: 'Jackson County',
};

describe('HubSchema', () => {
  it('accepts a valid hub', () => {
    expect(HubSchema.parse(validHub)).toEqual(validHub);
  });

  it.each([
    ['non-kebab ID', { id: 'Kansas_City' }],
    ['unknown state', { state: 'XX' }],
    ['latitude out of range', { lat: 91 }],
    ['longitude out of range', { lon: -181 }],
    ['short FIPS', { countyFips: '2909' }],
    ['empty name', { name: '' }],
  ])('rejects %s', (_label, override) => {
    expect(HubSchema.safeParse({ ...validHub, ...override }).success).toBe(false);
  });

  it('rejects a region that does not match the state', () => {
    const result = HubSchema.safeParse({ ...validHub, region: 'South' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['region']);
  });

  it('rejects missing fields', () => {
    const { countyName: _omitted, ...rest } = validHub;
    expect(HubSchema.safeParse(rest).success).toBe(false);
  });
});

describe('HubCatalogSchema', () => {
  it('rejects duplicate IDs', () => {
    expect(HubCatalogSchema.safeParse([validHub, validHub]).success).toBe(false);
  });

  it('rejects an empty catalog', () => {
    expect(HubCatalogSchema.safeParse([]).success).toBe(false);
  });
});

describe('buildHubIdSchema', () => {
  const HubId = buildHubIdSchema(['boston-ma', 'miami-fl']);

  it('accepts catalog IDs', () => {
    expect(HubId.parse('miami-fl')).toBe('miami-fl');
  });

  it('rejects IDs outside the catalog', () => {
    const result = HubId.safeParse('springfield-il');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Unknown hub ID: springfield-il');
  });

  it('throws for an empty catalog', () => {
    expect(() => buildHubIdSchema([])).toThrow();
  });
});
