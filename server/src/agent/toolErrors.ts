import { ToolMessage } from '@langchain/core/messages';
import { ToolInputParsingException } from '@langchain/core/tools';
import { createMiddleware } from 'langchain';
import { failure } from '../tools/index.js';

function unwrapToolError(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'toolError' in error) return error.toolError;
  return error;
}

// LangChain may reject input before our tool runs. Return the same error format.
export const toolErrorMiddleware = createMiddleware({
  name: 'ToolErrorEnvelope',
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      const original = unwrapToolError(error);
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
