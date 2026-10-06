import { tool } from 'langchain';
import type { ToolHandler } from '../tools/index.js';

// The graph sends tool inputs here and stores the JSON result as a ToolMessage.
export function toAgentTool(handler: ToolHandler) {
  return tool((input: unknown) => JSON.stringify(handler.run(input)), {
    name: handler.name,
    description: handler.description,
    schema: handler.schema,
  });
}
