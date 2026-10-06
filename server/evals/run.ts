import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { ChatAnthropic } from '@langchain/anthropic';
import { createHubAgent } from '../src/agent/agent.js';
import { createChatService, type ChatResult } from '../src/agent/chat.js';
import { parseEnv } from '../src/config/env.js';
import { ENV_FILE } from '../src/config/paths.js';
import { loadDataset } from '../src/data/load.js';
import { loadHubCatalog } from '../src/data/load.js';
import { createServices } from '../src/services/index.js';
import { createTools } from '../src/tools/index.js';
import { COMMON_CHECKS, buildCases, type Check, type EvalCase } from './cases.js';

function failedChecks(checks: readonly Check[], result: ChatResult): string[] {
  const failures: string[] = [];
  for (const check of checks) {
    const outcome = check.run(result);
    if (outcome !== true)
      failures.push(outcome === false ? check.name : `${check.name}: ${outcome}`);
  }
  return failures;
}

async function main(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  let env;
  try {
    env = parseEnv(process.env);
  } catch {
    console.error(
      'Evals call the real Claude API. Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL in .env (see .env.example).',
    );
    process.exitCode = 1;
    return;
  }

  // Same setup as server/src/index.ts, without the HTTP server.
  const hubs = await loadHubCatalog();
  const dataset = await loadDataset(hubs);
  const services = createServices(hubs, dataset);
  const model = new ChatAnthropic({ model: env.ANTHROPIC_MODEL, apiKey: env.ANTHROPIC_API_KEY });
  const agent = createHubAgent({ model, tools: createTools({ services, meta: dataset.meta }) });
  const chat = createChatService({ agent, hubIds: services.hubs.getHubIds() });

  const allCases = buildCases({ services });
  const wanted = process.argv.slice(2).filter((arg) => arg !== '--');
  const unknown = wanted.filter((id) => !allCases.some((c) => c.id === id));
  if (unknown.length > 0) {
    console.error(
      `Unknown case: ${unknown.join(', ')}\nAvailable: ${allCases.map((c) => c.id).join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }
  const cases: EvalCase[] =
    wanted.length > 0 ? allCases.filter((c) => wanted.includes(c.id)) : allCases;

  console.log(`Running ${cases.length} eval case(s) with ${env.ANTHROPIC_MODEL}\n`);
  let passed = 0;

  for (const evalCase of cases) {
    const threadId = randomUUID(); // One conversation per case.
    const started = Date.now();
    let result: ChatResult | undefined;
    let failures: string[];

    try {
      for (const message of evalCase.messages) result = await chat.chat(threadId, message);
      failures = result
        ? failedChecks([...COMMON_CHECKS, ...evalCase.checks], result)
        : ['no messages'];
    } catch (error) {
      failures = [`chat call failed: ${error instanceof Error ? error.message : String(error)}`];
    }

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (failures.length === 0) {
      passed++;
      console.log(`PASS  ${evalCase.id} (${seconds}s)`);
      continue;
    }
    console.log(`FAIL  ${evalCase.id} (${seconds}s)`);
    for (const failure of failures) console.log(`      - ${failure}`);
    if (result) {
      console.log(`      answer:      ${result.answer}`);
      console.log(`      explanation: ${result.explanation}`);
      console.log(
        `      hubIds: [${result.hubIds.join(', ')}]  tools: ${result.toolCalls.map((t) => `${t.name}${t.ok ? '' : ' (error)'}`).join(', ') || 'none'}`,
      );
    }
  }

  const rate = Math.round((passed / cases.length) * 100);
  console.log(`\n${passed}/${cases.length} passed (${rate}%)`);
  if (passed < cases.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('Eval run failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
