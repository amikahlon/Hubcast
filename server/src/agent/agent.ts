import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { ToolInputParsingException } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent, createMiddleware, providerStrategy, tool } from 'langchain';
import { FinalAnswerSchema } from '@hubcast/shared';
import { failure, type ToolHandler } from '../tools/index.js';
import { SYSTEM_PROMPT } from './prompt.js';

// The Claude agent (LangGraph). It chooses which tools to call, reads their results and
// returns a structured final answer. It never calculates anything itself:
//   chat.ts -> agent.ts -> tools/ -> services/

/** Upper limit of graph steps per message (each tool round is 2 steps) to stop tool loops. */
export const MAX_AGENT_STEPS = 16;

export interface AgentRun {
  /** The whole conversation of the thread, including this turn. */
  messages: BaseMessage[];
  /** Claude's final answer, not yet validated by us. */
  structuredResponse: unknown;
}

export interface AgentRunner {
  run(threadId: string, message: string): Promise<AgentRun>;
}

/** LangChain wraps errors thrown by a tool; the original error is in `toolError`. */
function unwrap(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'toolError' in error) return error.toolError;
  return error;
}

/**
 * Tools return errors instead of throwing, but LangChain checks the tool input against the
 * schema before the tool runs. This turns that failure into the same `{ ok: false, error }`
 * result, so Claude gets one error format (and no stack trace).
 */
const toolErrorMiddleware = createMiddleware({
  name: 'ToolErrorEnvelope',
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      const original = unwrap(error);
      const result =
        original instanceof ToolInputParsingException
          ? failure('VALIDATION_ERROR', original.message.replace(/\s+/g, ' ').trim())
          : failure('INTERNAL_ERROR', 'The tool failed unexpectedly.');
      if (result.error.code === 'INTERNAL_ERROR') console.error('Tool call failed:', error);
      return new ToolMessage({
        tool_call_id: request.toolCall.id ?? '',
        name: request.toolCall.name,
        content: JSON.stringify(result),
      });
    }
  },
});

/** The Claude agent: 4 tools, a structured final answer and in-memory conversation history. */
export function createHubAgent(options: {
  model: BaseChatModel;
  tools: readonly ToolHandler[];
}): AgentRunner {
  const tools = options.tools.map((handler) =>
    tool((input: unknown) => JSON.stringify(handler.run(input)), {
      name: handler.name,
      description: handler.description,
      schema: handler.schema,
    }),
  );

  const agent = createAgent({
    model: options.model,
    tools,
    systemPrompt: SYSTEM_PROMPT,
    // Native structured output: the final answer is validated against FinalAnswerSchema.
    responseFormat: providerStrategy(FinalAnswerSchema),
    middleware: [toolErrorMiddleware],
    checkpointer: new MemorySaver(),
  });

  return {
    // `thread_id` is how LangGraph keeps the conversation history of one chat.
    async run(threadId, message) {
      const result = await agent.invoke(
        { messages: [{ role: 'user', content: message }] },
        { configurable: { thread_id: threadId }, recursionLimit: MAX_AGENT_STEPS },
      );
      return { messages: result.messages, structuredResponse: result.structuredResponse };
    },
  };
}
