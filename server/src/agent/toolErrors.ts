import { ToolMessage } from '@langchain/core/messages';
import { ToolInputParsingException } from '@langchain/core/tools';
import { createMiddleware } from 'langchain';
import { failure } from '../tools/tools.js';

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
export const toolErrorMiddleware = createMiddleware({
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
