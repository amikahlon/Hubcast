import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { ENV_FILE } from './config/paths.js';
import { loadHubCatalog } from './data/hubs.js';
import { createHubsService } from './services/hubs.js';

async function main(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  const env = parseEnv(process.env);
  const hubs = await loadHubCatalog();

  const app = createApp({ hubsService: createHubsService(hubs), dataAsOf: null });
  app.listen(env.PORT, (error) => {
    if (error) {
      console.error(`Failed to listen on port ${env.PORT}:`, error.message);
      process.exit(1);
    }
    console.log(`Server listening on http://localhost:${env.PORT} (${hubs.length} hubs)`);
  });
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error instanceof Error ? error.message : error);
  process.exit(1);
});
