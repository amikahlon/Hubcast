import { readFile } from 'node:fs/promises';
import { HubCatalogSchema, type Hub } from '@hubcast/shared';
import { z } from 'zod';
import { HUBS_FILE } from '../config/paths.js';

/** Reads and validates the hub catalog. Throws if the file is missing or invalid. */
export async function loadHubCatalog(file: string = HUBS_FILE): Promise<Hub[]> {
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  const result = HubCatalogSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid hub catalog ${file}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
