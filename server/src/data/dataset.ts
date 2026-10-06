import { readFile } from 'node:fs/promises';
import {
  DataMetaSchema,
  HazardsFileSchema,
  WeatherFileSchema,
  type DataMeta,
  type HazardsFile,
  type Hub,
  type WeatherFile,
} from '@hubcast/shared';
import { z } from 'zod';
import { DATA_DIR } from '../config/paths.js';

export interface Dataset {
  meta: DataMeta;
  hazards: HazardsFile;
  /** Weather by hub ID. */
  weather: Map<string, WeatherFile>;
}

async function readJson<T extends z.ZodType>(file: string, schema: T): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read ${file}: ${reason}. Run "npm run refresh-data".`, {
      cause: error,
    });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid data file ${file}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Loads and validates all generated data. Throws if a file is missing, invalid or incomplete. */
export async function loadDataset(hubs: readonly Hub[], dir: string = DATA_DIR): Promise<Dataset> {
  const meta = await readJson(`${dir}meta.json`, DataMetaSchema);
  const hazards = await readJson(`${dir}hazards.json`, HazardsFileSchema);

  const weather = new Map<string, WeatherFile>();
  for (const hub of hubs) {
    if (hazards[hub.id] === undefined) {
      throw new Error(`hazards.json has no entry for hub ${hub.id}`);
    }
    const file = await readJson(`${dir}weather/${hub.id}.json`, WeatherFileSchema);
    if (file.hubId !== hub.id) {
      throw new Error(`weather/${hub.id}.json is for hub ${file.hubId}`);
    }
    if (file.startDate !== meta.weather.startDate || file.endDate !== meta.weather.endDate) {
      throw new Error(`weather/${hub.id}.json does not match the period in meta.json`);
    }
    weather.set(hub.id, file);
  }
  return { meta, hazards, weather };
}
