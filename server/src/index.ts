import { existsSync } from 'node:fs';
import { ChatAnthropic } from '@langchain/anthropic';
import { createHubAgent } from './agent/agent.js';
import { createChatService } from './agent/chat.js';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { ENV_FILE } from './config/paths.js';
import { loadDataset, loadHubCatalog } from './data/load.js';
import { createServices } from './services/index.js';
import { createTools } from './tools/index.js';

async function main(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  const env = parseEnv(process.env);
  const hubs = await loadHubCatalog();
  const dataset = await loadDataset(hubs);

  const services = createServices(hubs, dataset);
  const model = new ChatAnthropic({ model: env.ANTHROPIC_MODEL, apiKey: env.ANTHROPIC_API_KEY });
  const agent = createHubAgent({ model, tools: createTools({ services, meta: dataset.meta }) });
  const chatService = createChatService({ agent, hubIds: services.hubs.getHubIds() });

  const app = createApp({
    hubsService: services.hubs,
    chatService,
    dataAsOf: dataset.meta.refreshedAt,
  });
  app.listen(env.PORT, (error) => {
    if (error) {
      console.error(`Failed to listen on port ${env.PORT}:`, error.message);
      process.exit(1);
    }
    console.log(
      `Server listening on http://localhost:${env.PORT} (${hubs.length} hubs, data as of ${dataset.meta.refreshedAt}, model ${env.ANTHROPIC_MODEL})`,
    );
  });
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error instanceof Error ? error.message : error);
  process.exit(1);
});
