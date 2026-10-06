import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import type { DataMeta, WeatherFile } from '@hubcast/shared';
import { DATA_DIR } from '../src/config/paths.js';
import { loadHubCatalog } from '../src/data/hubs.js';
import { lastFullYears } from '../src/data/period.js';
import { NRI_SOURCE, fetchHazards } from '../src/data/sources/nri.js';
import { OPEN_METEO_SOURCE, fetchWeather } from '../src/data/sources/openMeteo.js';

async function main(): Promise<void> {
  const hubs = await loadHubCatalog();
  const today = new Date();
  const period = lastFullYears(today);

  // Fetch everything first so a failure never leaves a half-updated data folder.
  console.log(`Fetching FEMA NRI for ${hubs.length} counties...`);
  const { hazards, version } = await fetchHazards(hubs);

  const weather: WeatherFile[] = [];
  for (const hub of hubs) {
    console.log(`Fetching weather ${period.startDate}..${period.endDate}: ${hub.id}`);
    weather.push(await fetchWeather(hub, period));
  }

  const meta: DataMeta = {
    refreshedAt: today.toISOString().slice(0, 10),
    weather: { source: OPEN_METEO_SOURCE, ...period },
    hazards: { source: NRI_SOURCE, version },
  };

  // Write weather to a temp folder, then swap it in, so old files never mix with new ones.
  const weatherDir = `${DATA_DIR}weather`;
  const tempDir = `${DATA_DIR}weather.tmp`;
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  for (const file of weather) {
    await writeFile(`${tempDir}/${file.hubId}.json`, JSON.stringify(file) + '\n');
  }
  await rm(weatherDir, { recursive: true, force: true });
  await rename(tempDir, weatherDir);
  await writeFile(`${DATA_DIR}hazards.json`, JSON.stringify(hazards, null, 2) + '\n');
  await writeFile(`${DATA_DIR}meta.json`, JSON.stringify(meta, null, 2) + '\n');

  console.log(
    `Done: ${weather.length} weather files, NRI ${version}, refreshed ${meta.refreshedAt}`,
  );
}

main().catch((error: unknown) => {
  console.error('Data refresh failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
