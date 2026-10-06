import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import { GraphRecursionError } from '@langchain/langgraph';
import { AgentError, createChatService } from '../src/agent/chat.js';
import { collectTurnSummary } from '../src/agent/turnSummary.js';

const answer = {
  answer: 'Denver is a company hub.',
  hubIds: ['denver-co'],
  explanation: 'The catalog includes Denver.',
  assumptions: [],
};

function toolMessage(content: unknown, name = 'get_weather_stats') {
  return new ToolMessage({ name, tool_call_id: 'call', content: JSON.stringify(content) });
}

await test('sources and dates belong only to successful tools in the current turn', () => {
  const success = (sources: string[], dataAsOf: string | null) => ({
    ok: true,
    meta: { sources, dataAsOf },
  });
  const summary = collectTurnSummary([
    new HumanMessage('Previous question'),
    toolMessage(success(['Old source'], '2026-10-05')),
    new HumanMessage('Current question'),
    toolMessage(success(['Catalog'], null), 'list_hubs'),
    toolMessage(success(['Weather'], '2026-10-01')),
    toolMessage(success(['Weather', 'FEMA'], '2026-10-02'), 'get_risk_scores'),
    toolMessage({ ok: false, error: { code: 'OUT_OF_RANGE', message: 'Unavailable year.' } }),
    new ToolMessage({ tool_call_id: 'malformed', content: 'invalid JSON' }),
    toolMessage({ ok: true, meta: { sources: ['Bad date'], dataAsOf: 'invalid' } }),
  ]);
  assert.deepEqual(summary.sources, ['Catalog', 'Weather', 'FEMA']);
  assert.equal(summary.dataAsOf, '2026-10-02');
  assert.deepEqual(
    summary.toolCalls.map((call) => call.ok),
    [true, true, true, false, false, false],
  );
  assert.equal(summary.toolCalls[4]?.name, 'unknown');
});

await test('a turn without tools does not reuse previous sources', () => {
  assert.deepEqual(
    collectTurnSummary([
      new HumanMessage('Old question'),
      toolMessage({ ok: true, meta: { sources: ['Old source'], dataAsOf: '2026-10-01' } }),
      new HumanMessage('New question'),
    ]),
    { toolCalls: [], sources: [], dataAsOf: null },
  );
});

await test('chat forwards the thread and message and validates the answer', async () => {
  const chat = createChatService({
    hubIds: ['denver-co'],
    agent: {
      run: (threadId, message) => {
        assert.equal(threadId, 'thread');
        assert.equal(message, 'question');
        return Promise.resolve({
          messages: [new HumanMessage(message)],
          structuredResponse: answer,
        });
      },
    },
  });
  assert.deepEqual(await chat.chat('thread', 'question'), {
    ...answer,
    toolCalls: [],
    sources: [],
    dataAsOf: null,
  });
});

await test('chat rejects invalid output and hub IDs outside the catalog', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const response of [{ answer: 'Incomplete' }, { ...answer, hubIds: ['unknown-hub'] }]) {
    const chat = createChatService({
      hubIds: ['denver-co'],
      agent: { run: () => Promise.resolve({ messages: [], structuredResponse: response }) },
    });
    await assert.rejects(chat.chat('thread', 'question'), AgentError);
  }
});

await test('model failures and step limits become safe client errors', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const cause of [
    new Error('private provider error'),
    new GraphRecursionError('step limit'),
  ]) {
    const chat = createChatService({
      hubIds: ['denver-co'],
      agent: { run: () => Promise.reject(cause) },
    });
    await assert.rejects(chat.chat('thread', 'question'), (error: unknown) => {
      assert.ok(error instanceof AgentError);
      assert.equal(error.cause, cause);
      assert.match(
        error.message,
        cause instanceof GraphRecursionError ? /too many steps/ : /unavailable/,
      );
      return true;
    });
  }
});
