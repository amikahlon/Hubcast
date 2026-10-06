import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 2000;

export const FinalAnswerSchema = z.object({
  /** Direct answer. */
  answer: z.string().min(1),
  /** Hubs the answer is about (catalog IDs, may be empty). */
  hubIds: z.array(z.string()),
  /** Why, based only on tool results. */
  explanation: z.string().min(1),
  /** Assumptions or limitations (may be empty). */
  assumptions: z.array(z.string()),
});
export type FinalAnswer = z.infer<typeof FinalAnswerSchema>;

export const ChatRequestSchema = z.object({
  threadId: z.uuid(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ToolCallSummarySchema = z.object({
  name: z.string().min(1),
  ok: z.boolean(),
});
export type ToolCallSummary = z.infer<typeof ToolCallSummarySchema>;

export const ChatResponseSchema = FinalAnswerSchema.extend({
  threadId: z.uuid(),
  toolCalls: z.array(ToolCallSummarySchema),
  sources: z.array(z.string()),
  dataAsOf: z.iso.date().nullable(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
