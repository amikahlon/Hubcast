import type { Hub } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { createHubsService } from './hubs.js';

function hub(id: string, state: Hub['state'], region: Hub['region']): Hub {
  return {
    id,
    name: id,
    city: id,
    state,
    region,
    lat: 0,
    lon: 0,
    countyFips: '00000',
    countyName: 'Test County',
  };
}

const service = createHubsService([
  hub('houston-tx', 'TX', 'South'),
  hub('miami-fl', 'FL', 'South'),
  hub('dallas-tx', 'TX', 'South'),
  hub('denver-co', 'CO', 'West'),
]);

const ids = (hubs: Hub[]) => hubs.map((h) => h.id);

describe('hubs service', () => {
  it('lists all hubs in catalog order without a filter', () => {
    expect(ids(service.listHubs())).toEqual(['houston-tx', 'miami-fl', 'dallas-tx', 'denver-co']);
  });

  it('filters by region', () => {
    expect(ids(service.listHubs({ region: 'West' }))).toEqual(['denver-co']);
  });

  it('filters by state', () => {
    expect(ids(service.listHubs({ state: 'TX' }))).toEqual(['houston-tx', 'dallas-tx']);
  });

  it('combines filters', () => {
    expect(ids(service.listHubs({ region: 'South', state: 'FL' }))).toEqual(['miami-fl']);
    expect(service.listHubs({ region: 'West', state: 'TX' })).toEqual([]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(service.listHubs({ region: 'Northeast' })).toEqual([]);
  });

  it('returns hub IDs', () => {
    expect(service.getHubIds()).toEqual(['houston-tx', 'miami-fl', 'dallas-tx', 'denver-co']);
  });
});
