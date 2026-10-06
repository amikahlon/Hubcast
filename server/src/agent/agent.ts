import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent, providerStrategy } from 'langchain';
import { FinalAnswerSchema } from '@hubcast/shared';
import type { ToolHandler } from '../tools/index.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { toolErrorMiddleware } from './toolErrors.js';
import { toAgentTool } from './toolAdapter.js';

/** Stops repeated tool calls from keeping a turn open forever. */
export const MAX_AGENT_STEPS = 16;

export interface AgentRun {
  /** Full thread history, including this turn. */
  messages: BaseMessage[];
  /** The chat service validates this before returning it to the client. */
  structuredResponse: unknown;
}

export interface AgentRunner {
  run(threadId: string, message: string): Promise<AgentRun>;
}

// createAgent builds the LangGraph loop: model -> tools -> model -> final answer.
// The model chooses tools; the services behind them calculate all numbers.
export function createHubAgent(options: {
  model: BaseChatModel;
  tools: readonly ToolHandler[];
}): AgentRunner {
  const agent = createAgent({
    model: options.model,
    tools: options.tools.map(toAgentTool),
    systemPrompt: SYSTEM_PROMPT,
    // The model returns the final answer in this shape.
    responseFormat: providerStrategy(FinalAnswerSchema),
    middleware: [toolErrorMiddleware],
    checkpointer: new MemorySaver(),
  });

  return {
    async run(threadId, message) {
      const result = await agent.invoke(
        { messages: [{ role: 'user', content: message }] },
        // The checkpointer restores and saves the conversation for this thread.
        { configurable: { thread_id: threadId }, recursionLimit: MAX_AGENT_STEPS },
      );
      return { messages: result.messages, structuredResponse: result.structuredResponse };
    },
  };
}
