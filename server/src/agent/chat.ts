import { GraphRecursionError } from '@langchain/langgraph';
import type { ChatResponse } from '@hubcast/shared';
import type { AgentRunner, AgentRun } from './agent.js';
import { createAnswerValidator } from './answer.js';
import { AgentError } from './errors.js';
import { collectTurnSummary } from './turnSummary.js';

export { AgentError } from './errors.js';

/** The route adds threadId to this result. */
export type ChatResult = Omit<ChatResponse, 'threadId'>;

export interface ChatService {
  chat(threadId: string, message: string): Promise<ChatResult>;
}

async function runAgent(agent: AgentRunner, threadId: string, message: string): Promise<AgentRun> {
  try {
    return await agent.run(threadId, message);
  } catch (error) {
    console.error('Agent failed:', error);
    throw new AgentError(
      error instanceof GraphRecursionError
        ? 'The assistant needed too many steps to answer. Please try a simpler question.'
        : 'The assistant is unavailable right now. Please try again.',
      { cause: error },
    );
  }
}

// One turn: run the graph, validate its answer, then attach tool usage and sources.
export function createChatService(deps: {
  agent: AgentRunner;
  hubIds: readonly string[];
}): ChatService {
  const validateAnswer = createAnswerValidator(deps.hubIds);

  return {
    async chat(threadId, message) {
      const run = await runAgent(deps.agent, threadId, message);
      const answer = validateAnswer(run.structuredResponse);
      const summary = collectTurnSummary(run.messages);
      return { ...answer, ...summary };
    },
  };
}
