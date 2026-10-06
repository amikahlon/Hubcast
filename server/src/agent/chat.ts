import { HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { GraphRecursionError } from '@langchain/langgraph';
import {
  FinalAnswerSchema,
  ToolMetaSchema,
  buildHubIdSchema,
  type ChatResponse,
  type ToolCallSummary,
} from '@hubcast/shared';
import { z } from 'zod';
import type { AgentRunner } from './agent.js';

// The entry point of the AI flow. Everything for one chat message goes through here:
//   routes/chat.ts -> chat.ts (this file) -> agent.ts -> tools/ -> services/
// It runs the agent, validates the final answer and collects which tools and data were used.

/** The agent could not produce a valid answer. The message is safe to show to API clients. */
export class AgentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AgentError';
  }
}

/** What the chat service returns; the route adds `threadId`. */
export type ChatResult = Omit<ChatResponse, 'threadId'>;

export interface ChatService {
  chat(threadId: string, message: string): Promise<ChatResult>;
}

/** Shape of a tool result as it arrives in a ToolMessage. */
const ToolEnvelopeSchema = z.union([
  z.object({ ok: z.literal(true), meta: ToolMetaSchema }),
  z.object({ ok: z.literal(false) }),
]);

/** Tool calls, sources and data date of the current turn: everything after the last user message. */
function collectToolInfo(
  messages: readonly BaseMessage[],
): Pick<ChatResult, 'toolCalls' | 'sources' | 'dataAsOf'> {
  const turn = messages.slice(
    messages.findLastIndex((message) => HumanMessage.isInstance(message)) + 1,
  );
  const toolCalls: ToolCallSummary[] = [];
  const sources = new Set<string>();
  let dataAsOf: string | null = null;

  for (const message of turn) {
    if (!ToolMessage.isInstance(message)) continue;
    let envelope: z.infer<typeof ToolEnvelopeSchema> | undefined;
    try {
      const parsed = ToolEnvelopeSchema.safeParse(JSON.parse(message.text));
      envelope = parsed.success ? parsed.data : undefined;
    } catch {
      envelope = undefined;
    }
    toolCalls.push({ name: message.name ?? 'unknown', ok: envelope?.ok === true });
    if (envelope?.ok !== true) continue;
    for (const source of envelope.meta.sources) sources.add(source);
    if (
      envelope.meta.dataAsOf !== null &&
      (dataAsOf === null || envelope.meta.dataAsOf > dataAsOf)
    ) {
      dataAsOf = envelope.meta.dataAsOf;
    }
  }
  return { toolCalls, sources: [...sources], dataAsOf };
}

/**
 * Runs one message through the agent. A failed model call, an invalid answer or a hub ID
 * outside the catalog becomes an `AgentError`, which the route returns as `AGENT_ERROR`.
 */
export function createChatService(deps: {
  agent: AgentRunner;
  hubIds: readonly string[];
}): ChatService {
  const HubId = buildHubIdSchema(deps.hubIds);

  return {
    async chat(threadId, message) {
      let run;
      try {
        run = await deps.agent.run(threadId, message);
      } catch (error) {
        console.error('Agent failed:', error);
        throw new AgentError(
          error instanceof GraphRecursionError
            ? 'The assistant needed too many steps to answer. Please try a simpler question.'
            : 'The assistant is unavailable right now. Please try again.',
          { cause: error },
        );
      }

      const answer = FinalAnswerSchema.safeParse(run.structuredResponse);
      if (!answer.success) {
        console.error('Invalid final answer:', z.prettifyError(answer.error));
        throw new AgentError('The assistant returned an invalid answer.', { cause: answer.error });
      }
      const unknownHubIds = answer.data.hubIds.filter((id) => !HubId.safeParse(id).success);
      if (unknownHubIds.length > 0) {
        console.error('Final answer has unknown hub IDs:', unknownHubIds);
        throw new AgentError('The assistant returned an answer about an unknown hub.');
      }

      return { ...answer.data, ...collectToolInfo(run.messages) };
    },
  };
}
