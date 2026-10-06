import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '../config/paths.js';
import { loadDataset } from './dataset.js';
import { loadHubCatalog } from './hubs.js';

const hubs = await loadHubCatalog();

function daysBetween(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
}

describe('committed data (data/)', async () => {
  const dataset = await loadDataset(hubs);

  it('has weather and hazards for all 19 hubs', () => {
    expect(dataset.weather.size).toBe(19);
    expect(Object.keys(dataset.hazards).sort()).toEqual(hubs.map((hub) => hub.id).sort());
  });

  it('has one record per day for the whole period, without gaps', () => {
    const { startDate, endDate } = dataset.meta.weather;
    for (const hub of hubs) {
      const days = dataset.weather.get(hub.id)?.days ?? [];
      expect(days, hub.id).toHaveLength(daysBetween(startDate, endDate));
      expect(days[0]?.date).toBe(startDate);
      expect(days.at(-1)?.date).toBe(endDate);
      days.forEach((day, i) => {
        if (i > 0) expect(daysBetween(days[i - 1]?.date ?? '', day.date), hub.id).toBe(2);
      });
    }
  });

  it('covers 3 full calendar years', () => {
    const { startDate, endDate } = dataset.meta.weather;
    expect(startDate).toMatch(/^\d{4}-01-01$/);
    expect(endDate).toMatch(/^\d{4}-12-31$/);
    expect(Number(endDate.slice(0, 4)) - Number(startDate.slice(0, 4))).toBe(2);
  });

  it('uses the hub county FIPS codes', () => {
    for (const hub of hubs) {
      expect(dataset.hazards[hub.id]?.countyFips).toBe(hub.countyFips);
    }
  });
});

describe('loadDataset', () => {
  async function copyOfData(): Promise<string> {
    const dir = (await mkdtemp(join(tmpdir(), 'hubcast-data-'))) + '/';
    await cp(DATA_DIR, dir, { recursive: true });
    return dir;
  }

  it('fails when a hub has no weather file', async () => {
    const dir = await copyOfData();
    await rm(`${dir}weather/${hubs[0]?.id}.json`);
    await expect(loadDataset(hubs, dir)).rejects.toThrow(/refresh-data/);
  });

  it('fails when a data file is invalid', async () => {
    const dir = await copyOfData();
    await writeFile(`${dir}meta.json`, JSON.stringify({ refreshedAt: 'never' }));
    await expect(loadDataset(hubs, dir)).rejects.toThrow(/Invalid data file/);
  });

  it('fails when the hazards file is missing a hub', async () => {
    const dir = await copyOfData();
    const hazards = (await loadDataset(hubs, dir)).hazards;
    delete hazards[hubs[0]?.id ?? ''];
    await writeFile(`${dir}hazards.json`, JSON.stringify(hazards));
    await expect(loadDataset(hubs, dir)).rejects.toThrow(/no entry for hub/);
  });
});
