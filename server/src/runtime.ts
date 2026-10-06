import { ChatAnthropic } from '@langchain/anthropic';
import { createHubAgent } from './agent/agent.js';
import { createChatService } from './agent/chat.js';
import type { Env } from './config/env.js';
import { loadDataset, loadHubCatalog } from './data/load.js';
import { createServices } from './services/index.js';
import { createTools } from './tools/index.js';

// The HTTP server and evals use the same data, services, tools and agent setup.
export async function createRuntime(env: Env) {
  const hubs = await loadHubCatalog();
  const dataset = await loadDataset(hubs);
  const services = createServices(hubs, dataset);
  const tools = createTools({ services, meta: dataset.meta });
  const model = new ChatAnthropic({ model: env.ANTHROPIC_MODEL, apiKey: env.ANTHROPIC_API_KEY });
  const agent = createHubAgent({ model, tools });
  const chatService = createChatService({ agent, hubIds: services.hubs.getHubIds() });

  return { hubs, dataset, services, chatService };
}
