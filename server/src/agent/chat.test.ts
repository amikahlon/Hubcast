import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { GraphRecursionError } from '@langchain/langgraph';
import { describe, expect, it, vi } from 'vitest';
import type { AgentRun, AgentRunner } from './agent.js';
import { createChatService } from './chat.js';
import { AgentError } from './errors.js';

const validAnswer = {
  answer: 'Houston ranks first.',
  hubIds: ['houston-tx'],
  explanation: 'Highest overall score: 79.9.',
  assumptions: ['Scores are judgment-based.'],
};

const hubIds = ['houston-tx', 'dallas-tx', 'denver-co'];

function toolResult(name: string, result: unknown, id: string): ToolMessage {
  return new ToolMessage({ name, tool_call_id: id, content: JSON.stringify(result) });
}

const okMeta = (sources: string[], dataAsOf: string | null) => ({
  ok: true,
  data: {},
  meta: { sources, dataAsOf },
});

function service(run: () => Promise<AgentRun>) {
  const agent: AgentRunner = { run };
  return createChatService({ agent, hubIds });
}

describe('chat service', () => {
  it('returns the validated answer with the tool calls, sources and data date of this turn', async () => {
    const chat = service(() =>
      Promise.resolve({
        structuredResponse: validAnswer,
        messages: [
          // Earlier turn: must not be reported.
          new HumanMessage('Old question'),
          toolResult('get_hazard_exposure', okMeta(['FEMA'], '2025-01-01'), 'old'),
          new AIMessage('old answer'),
          // This turn.
          new HumanMessage('Which hub is riskiest?'),
          toolResult('get_risk_scores', okMeta(['Open-Meteo', 'FEMA'], '2026-10-06'), 'a'),
          toolResult('get_weather_stats', okMeta(['Open-Meteo'], '2026-10-05'), 'b'),
          toolResult(
            'get_weather_stats',
            { ok: false, error: { code: 'OUT_OF_RANGE', message: 'x' } },
            'c',
          ),
          new AIMessage('final'),
        ],
      }),
    );

    expect(await chat.chat('thread', 'Which hub is riskiest?')).toEqual({
      ...validAnswer,
      toolCalls: [
        { name: 'get_risk_scores', ok: true },
        { name: 'get_weather_stats', ok: true },
        { name: 'get_weather_stats', ok: false },
      ],
      sources: ['Open-Meteo', 'FEMA'],
      dataAsOf: '2026-10-06',
    });
  });

  it('returns empty tool info when no tool was called', async () => {
    const chat = service(() =>
      Promise.resolve({
        structuredResponse: { ...validAnswer, hubIds: [] },
        messages: [new HumanMessage('Hi'), new AIMessage('final')],
      }),
    );
    expect(await chat.chat('thread', 'Hi')).toMatchObject({
      toolCalls: [],
      sources: [],
      dataAsOf: null,
    });
  });

  it('does not count failed tools or unreadable tool output as sources', async () => {
    const chat = service(() =>
      Promise.resolve({
        structuredResponse: validAnswer,
        messages: [
          new HumanMessage('Hi'),
          toolResult(
            'get_risk_scores',
            { ok: false, error: { code: 'INTERNAL_ERROR', message: 'x' } },
            'a',
          ),
          new ToolMessage({ name: 'list_hubs', tool_call_id: 'b', content: 'not json' }),
        ],
      }),
    );
    expect(await chat.chat('thread', 'Hi')).toMatchObject({
      toolCalls: [
        { name: 'get_risk_scores', ok: false },
        { name: 'list_hubs', ok: false },
      ],
      sources: [],
      dataAsOf: null,
    });
  });

  it('passes threadId and message to the agent', async () => {
    const run = vi.fn(() =>
      Promise.resolve({ structuredResponse: validAnswer, messages: [new HumanMessage('Hi')] }),
    );
    const agent = { run } as AgentRunner;
    await createChatService({ agent, hubIds }).chat('thread-42', 'Hello there');
    expect(run).toHaveBeenCalledWith('thread-42', 'Hello there');
  });

  describe('AGENT_ERROR cases', () => {
    const messages = [new HumanMessage('Hi')];

    it.each([
      ['no structured response', undefined],
      ['an answer missing fields', { answer: 'x' }],
      ['an empty answer', { ...validAnswer, answer: '' }],
    ])('rejects %s', async (_label, structuredResponse) => {
      const chat = service(() => Promise.resolve({ structuredResponse, messages }));
      await expect(chat.chat('t', 'Hi')).rejects.toThrow(AgentError);
      await expect(chat.chat('t', 'Hi')).rejects.toThrow('invalid answer');
    });

    it('rejects hub IDs that are not in the catalog', async () => {
      const chat = service(() =>
        Promise.resolve({
          structuredResponse: { ...validAnswer, hubIds: ['houston-tx', 'springfield-il'] },
          messages,
        }),
      );
      await expect(chat.chat('t', 'Hi')).rejects.toThrow(AgentError);
      await expect(chat.chat('t', 'Hi')).rejects.toThrow('unknown hub');
    });

    it('turns model failures into an error that hides the details', async () => {
      const chat = service(() => Promise.reject(new Error('401 invalid x-api-key sk-secret')));
      const error = await chat.chat('t', 'Hi').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AgentError);
      expect((error as AgentError).message).toBe(
        'The assistant is unavailable right now. Please try again.',
      );
      expect((error as AgentError).message).not.toContain('secret');
    });

    it('explains the step limit', async () => {
      const chat = service(() =>
        Promise.reject(new GraphRecursionError('Recursion limit of 16 reached')),
      );
      await expect(chat.chat('t', 'Hi')).rejects.toThrow('too many steps');
    });
  });
});
