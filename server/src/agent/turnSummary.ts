import { HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { ToolMetaSchema, type ChatResponse, type ToolCallSummary } from '@hubcast/shared';
import { z } from 'zod';

type TurnSummary = Pick<ChatResponse, 'toolCalls' | 'sources' | 'dataAsOf'>;

// Only the status and metadata are needed here, not the tool's data payload.
const ToolEnvelopeSchema = z.union([
  z.object({ ok: z.literal(true), meta: ToolMetaSchema }),
  z.object({ ok: z.literal(false) }),
]);

function readToolEnvelope(message: ToolMessage) {
  try {
    const parsed = ToolEnvelopeSchema.safeParse(JSON.parse(message.text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function collectTurnSummary(messages: readonly BaseMessage[]): TurnSummary {
  // Memory contains older turns too. Report only tools after the last user message.
  const turn = messages.slice(
    messages.findLastIndex((message) => HumanMessage.isInstance(message)) + 1,
  );
  const toolCalls: ToolCallSummary[] = [];
  const sources = new Set<string>();
  let dataAsOf: string | null = null;

  for (const message of turn) {
    if (!ToolMessage.isInstance(message)) continue;
    const envelope = readToolEnvelope(message);
    toolCalls.push({ name: message.name ?? 'unknown', ok: envelope?.ok === true });
    if (envelope?.ok !== true) continue;

    for (const source of envelope.meta.sources) sources.add(source);
    const date = envelope.meta.dataAsOf;
    if (date !== null && (dataAsOf === null || date > dataAsOf)) dataAsOf = date;
  }
  return { toolCalls, sources: [...sources], dataAsOf };
}
