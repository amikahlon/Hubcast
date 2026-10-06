import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import { FinalAnswerSchema } from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { loadDataset } from '../data/dataset.js';
import { loadHubCatalog } from '../data/hubs.js';
import { createServices } from '../services/index.js';
import { createTools } from '../tools/tools.js';
import { MAX_AGENT_STEPS, createHubAgent } from './agent.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { ScriptedChatModel, callTool, finalAnswer } from './scriptedModel.js';

const hubs = await loadHubCatalog();
const dataset = await loadDataset(hubs);
const tools = createTools({ services: createServices(hubs, dataset), meta: dataset.meta });

const answer = {
  answer: 'Dallas ranks first for heat.',
  hubIds: ['dallas-tx'],
  explanation: 'Its heat score is the highest.',
  assumptions: [],
};

function toolMessages(messages: readonly { getType(): string }[]): ToolMessage[] {
  return messages.filter((m): m is ToolMessage => ToolMessage.isInstance(m));
}

describe('createHubAgent', () => {
  it('calls a tool, gets the real service result and returns the final structured answer', async () => {
    const model = new ScriptedChatModel([
      callTool('get_risk_scores', { sortBy: 'heat' }),
      finalAnswer(answer),
    ]);
    const agent = createHubAgent({ model, tools });

    const run = await agent.run('thread-1', 'Which hub has the highest heat risk?');

    expect(FinalAnswerSchema.parse(run.structuredResponse)).toEqual(answer);
    const [message] = toolMessages(run.messages);
    const result = JSON.parse(message?.text ?? '') as {
      ok: boolean;
      data: { sortBy: string; hubs: { hubId: string; rank: number }[] };
    };
    expect(message?.name).toBe('get_risk_scores');
    expect(result.ok).toBe(true);
    expect(result.data.sortBy).toBe('heat');
    expect(result.data.hubs).toHaveLength(19);
    expect(result.data.hubs[0]?.rank).toBe(1);
  });

  it('gives Claude the system prompt and the user message', async () => {
    const model = new ScriptedChatModel([finalAnswer(answer)]);
    await createHubAgent({ model, tools }).run('thread-1', 'Hello');

    const [first] = model.received;
    expect(first?.[0]?.getType()).toBe('system');
    expect(first?.[0]?.text).toBe(SYSTEM_PROMPT);
    expect(first?.at(-1)?.text).toBe('Hello');
  });

  it('keeps the history of a thread and separates threads', async () => {
    const model = new ScriptedChatModel([
      finalAnswer(answer),
      finalAnswer(answer),
      finalAnswer(answer),
    ]);
    const agent = createHubAgent({ model, tools });
    const humanTexts = (calls: number) =>
      model.received[calls]?.filter((m) => HumanMessage.isInstance(m)).map((m) => m.text);

    await agent.run('thread-a', 'First question');
    await agent.run('thread-a', 'Follow-up');
    await agent.run('thread-b', 'Other conversation');

    expect(humanTexts(0)).toEqual(['First question']);
    expect(humanTexts(1)).toEqual(['First question', 'Follow-up']);
    expect(humanTexts(2)).toEqual(['Other conversation']);
  });

  it('returns invalid tool input to Claude as a clean tool error', async () => {
    const model = new ScriptedChatModel([
      callTool('get_weather_stats', { hubIds: ['springfield-il'] }),
      finalAnswer({ ...answer, hubIds: [], answer: 'Springfield is not a company hub.' }),
    ]);
    const run = await createHubAgent({ model, tools }).run('thread-1', 'Weather in Springfield?');

    const [message] = toolMessages(run.messages);
    const result = JSON.parse(message?.text ?? '') as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.message).toContain('springfield-il');
    expect(result.error.message).not.toContain('    at ');
    // The agent continued and answered.
    expect(FinalAnswerSchema.parse(run.structuredResponse).hubIds).toEqual([]);
  });

  it('returns a service error such as OUT_OF_RANGE to Claude as a tool error', async () => {
    const model = new ScriptedChatModel([
      callTool('get_weather_stats', { hubIds: ['denver-co'], year: 1999 }),
      finalAnswer(answer),
    ]);
    const run = await createHubAgent({ model, tools }).run('thread-1', 'Denver snow in 1999?');
    const [message] = toolMessages(run.messages);
    expect(JSON.parse(message?.text ?? '')).toMatchObject({
      ok: false,
      error: { code: 'OUT_OF_RANGE' },
    });
  });

  it('stops a tool loop at the step limit', async () => {
    const model = new ScriptedChatModel((i) => callTool('list_hubs', {}, `call-${i}`));
    const agent = createHubAgent({ model, tools });

    await expect(agent.run('thread-1', 'Loop forever')).rejects.toThrow(/Recursion limit/);
    expect(model.received.length).toBeLessThanOrEqual(MAX_AGENT_STEPS);
  });
});
