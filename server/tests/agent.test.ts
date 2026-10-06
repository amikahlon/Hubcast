import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { GraphRecursionError } from '@langchain/langgraph';
import { z } from 'zod';
import { createHubAgent } from '../src/agent/agent.js';
import { collectTurnSummary } from '../src/agent/turnSummary.js';
import { defineTool } from '../src/tools/tool.js';

const answer = {
  answer: 'Denver is a company hub.',
  hubIds: ['denver-co'],
  explanation: 'The hub catalog includes Denver.',
  assumptions: [],
};

// Run the real graph with predictable model replies and no network calls.
class ScriptedModel extends BaseChatModel {
  readonly seen: BaseMessage[][] = [];

  constructor(private readonly reply: (messages: BaseMessage[]) => AIMessage) {
    super({});
  }

  _llmType() {
    return 'scripted';
  }

  override bindTools() {
    return this;
  }

  _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.seen.push([...messages]);
    const message = this.reply(messages);
    return Promise.resolve({ generations: [{ text: message.text, message }] });
  }
}

const listHubs = defineTool({
  name: 'list_hubs',
  description: 'List company hubs.',
  schema: z.object({ state: z.literal('CO').optional() }),
  sources: ['Company hub catalog'],
  dataAsOf: null,
  call: () => ({ hubs: [{ id: 'denver-co' }] }),
});

function callTool(args: Record<string, unknown> = {}) {
  return new AIMessage({
    content: '',
    tool_calls: [{ id: 'call-hubs', name: 'list_hubs', args, type: 'tool_call' }],
  });
}

await test('graph calls a tool, reads its result and returns structured output', async () => {
  const model = new ScriptedModel((messages) =>
    ToolMessage.isInstance(messages.at(-1)) ? new AIMessage(JSON.stringify(answer)) : callTool(),
  );
  const agent = createHubAgent({ model, tools: [listHubs] });
  const result = await agent.run('first', 'List the hubs.');

  assert.deepEqual(result.structuredResponse, answer);
  const toolMessage = result.messages.find((message) => ToolMessage.isInstance(message));
  assert.ok(toolMessage);
  assert.deepEqual(JSON.parse(toolMessage.text), listHubs.run({}));
  assert.deepEqual(collectTurnSummary(result.messages), {
    toolCalls: [{ name: 'list_hubs', ok: true }],
    sources: ['Company hub catalog'],
    dataAsOf: null,
  });

  await agent.run('first', 'What about its state?');
  const followUp = model.seen.at(-2);
  assert.ok(followUp?.some((message) => message.text === 'List the hubs.'));
  const isolated = await agent.run('second', 'Start a new conversation.');
  assert.equal(isolated.messages.filter((message) => HumanMessage.isInstance(message)).length, 1);
});

await test('invalid tool input returns an error to the model and allows a corrected call', async () => {
  let step = 0;
  const model = new ScriptedModel(() => {
    step++;
    if (step === 1) return callTool({ state: 'invalid' });
    if (step === 2) return callTool({ state: 'CO' });
    return new AIMessage(JSON.stringify(answer));
  });
  const result = await createHubAgent({ model, tools: [listHubs] }).run('validation', 'List hubs.');
  const messages = result.messages.filter((message) => ToolMessage.isInstance(message));
  assert.equal(messages.length, 2);
  const failure: unknown = JSON.parse(messages[0]!.text);
  assert.ok(
    z
      .object({ ok: z.literal(false), error: z.object({ code: z.literal('VALIDATION_ERROR') }) })
      .safeParse(failure).success,
  );
  assert.deepEqual(JSON.parse(messages[1]!.text), listHubs.run({ state: 'CO' }));
  assert.deepEqual(result.structuredResponse, answer);
});

await test('the graph stops a model that keeps requesting tools', async () => {
  const model = new ScriptedModel(() => callTool());
  const agent = createHubAgent({ model, tools: [listHubs] });
  await assert.rejects(agent.run('loop', 'List hubs.'), GraphRecursionError);
});
