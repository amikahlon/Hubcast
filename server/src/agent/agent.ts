import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent, providerStrategy, tool } from 'langchain';
import { FinalAnswerSchema } from '@hubcast/shared';
import type { ToolHandler } from '../tools/tools.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { toolErrorMiddleware } from './toolErrors.js';

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
    async run(threadId, message) {
      const result = await agent.invoke(
        { messages: [{ role: 'user', content: message }] },
        { configurable: { thread_id: threadId }, recursionLimit: MAX_AGENT_STEPS },
      );
      return { messages: result.messages, structuredResponse: result.structuredResponse };
    },
  };
}
