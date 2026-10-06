import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { regionForState, type Region } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { loadHubCatalog } from './hubs.js';

describe('hub catalog (data/hubs.json)', async () => {
  const hubs = await loadHubCatalog();

  it('has 19 hubs', () => {
    expect(hubs).toHaveLength(19);
  });

  it('has unique IDs', () => {
    expect(new Set(hubs.map((hub) => hub.id)).size).toBe(hubs.length);
  });

  it('has a region matching each state', () => {
    for (const hub of hubs) {
      expect(hub.region, hub.id).toBe(regionForState(hub.state));
    }
  });

  it('has the planned hubs per region', () => {
    const ids = (region: Region) =>
      hubs.filter((hub) => hub.region === region).map((hub) => hub.id);
    expect(ids('Northeast')).toEqual(['boston-ma', 'newark-nj', 'philadelphia-pa']);
    expect(ids('Midwest')).toEqual([
      'chicago-il',
      'minneapolis-mn',
      'detroit-mi',
      'kansas-city-mo',
      'indianapolis-in',
    ]);
    expect(ids('South')).toEqual([
      'miami-fl',
      'houston-tx',
      'dallas-tx',
      'atlanta-ga',
      'new-orleans-la',
      'memphis-tn',
    ]);
    expect(ids('West')).toEqual([
      'denver-co',
      'phoenix-az',
      'los-angeles-ca',
      'sacramento-ca',
      'salt-lake-city-ut',
    ]);
  });

  it('uses county FIPS codes that start with the state FIPS', () => {
    const stateFips: Record<string, string> = {
      MA: '25',
      NJ: '34',
      PA: '42',
      IL: '17',
      MN: '27',
      MI: '26',
      MO: '29',
      IN: '18',
      FL: '12',
      TX: '48',
      GA: '13',
      LA: '22',
      TN: '47',
      CO: '08',
      AZ: '04',
      CA: '06',
      UT: '49',
    };
    for (const hub of hubs) {
      expect(hub.countyFips.slice(0, 2), hub.id).toBe(stateFips[hub.state]);
    }
  });
});

describe('loadHubCatalog', () => {
  it('throws for an invalid file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hubcast-'));
    const file = join(dir, 'hubs.json');
    await writeFile(file, JSON.stringify([{ id: 'nowhere' }]));
    await expect(loadHubCatalog(file)).rejects.toThrow(/Invalid hub catalog/);
  });
});
