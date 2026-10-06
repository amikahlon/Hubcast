import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url));

export const ENV_FILE = `${ROOT_DIR}.env`;
export const DATA_DIR = `${ROOT_DIR}data/`;
export const HUBS_FILE = `${DATA_DIR}hubs.json`;
