import { describe, expect, it } from 'vitest';
import {
  ChatRequestSchema,
  ChatResponseSchema,
  FinalAnswerSchema,
  MAX_MESSAGE_LENGTH,
} from './chat.js';

const threadId = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';

const finalAnswer = {
  answer: 'Minneapolis has the highest winter risk in the Midwest.',
  hubIds: ['minneapolis-mn'],
  explanation: 'It has the most heavy snow days.',
  assumptions: [],
};

describe('FinalAnswerSchema', () => {
  it('accepts a valid answer with empty arrays', () => {
    expect(FinalAnswerSchema.parse({ ...finalAnswer, hubIds: [] })).toEqual({
      ...finalAnswer,
      hubIds: [],
    });
  });

  it.each([
    ['empty answer', { ...finalAnswer, answer: '' }],
    ['missing explanation', { answer: 'x', hubIds: [], assumptions: [] }],
    ['hubIds not an array', { ...finalAnswer, hubIds: 'minneapolis-mn' }],
  ])('rejects %s', (_label, input) => {
    expect(FinalAnswerSchema.safeParse(input).success).toBe(false);
  });
});

describe('ChatRequestSchema', () => {
  it('accepts a valid request and trims the message', () => {
    expect(ChatRequestSchema.parse({ threadId, message: '  Hi  ' })).toEqual({
      threadId,
      message: 'Hi',
    });
  });

  it.each([
    ['non-UUID threadId', { threadId: 'abc', message: 'Hi' }],
    ['blank message', { threadId, message: '   ' }],
    ['too long message', { threadId, message: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) }],
    ['missing threadId', { message: 'Hi' }],
  ])('rejects %s', (_label, input) => {
    expect(ChatRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe('ChatResponseSchema', () => {
  const response = {
    ...finalAnswer,
    threadId,
    toolCalls: [{ name: 'get_risk_scores', ok: true }],
    sources: ['Open-Meteo', 'FEMA NRI'],
    dataAsOf: '2026-01-15',
  };

  it('accepts a valid response', () => {
    expect(ChatResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a response without server fields', () => {
    expect(ChatResponseSchema.safeParse({ ...finalAnswer, threadId }).success).toBe(false);
  });
});
