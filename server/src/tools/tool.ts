import type {
  DataMeta,
  ToolFailure,
  ToolInputSchemas,
  ToolName,
  ToolResult,
} from '@hubcast/shared';
import type { z } from 'zod';
import { ServiceError } from '../services/common.js';
import type { Services } from '../services/index.js';
import { formatIssues } from '../utils.js';

/** A tool definition independent of LangChain. */
export interface ToolHandler {
  name: ToolName;
  description: string;
  schema: z.ZodType;
  /** Validates the input, calls one service and returns `{ ok, data, meta }` or `{ ok: false, error }`. */
  run(input: unknown): ToolResult<unknown>;
}

/** Shared context for the four tool factories. */
export interface ToolDeps {
  services: Services;
  meta: DataMeta;
  schemas: ToolInputSchemas;
}

export function failure(code: ToolFailure['error']['code'], message: string): ToolFailure {
  return { ok: false, error: { code, message } };
}

interface ToolDefinition<S extends z.ZodType> {
  name: ToolName;
  description: string;
  schema: S;
  sources: string[];
  dataAsOf: string | null;
  call: (input: z.output<S>) => unknown;
}

// Every tool follows the same path: validate -> call service -> return data or error.
export function defineTool<S extends z.ZodType>(definition: ToolDefinition<S>): ToolHandler {
  const { name, description, schema, sources, dataAsOf, call } = definition;
  return {
    name,
    description,
    schema,
    run(input) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) return failure('VALIDATION_ERROR', formatIssues(parsed.error));
      try {
        return { ok: true, data: call(parsed.data), meta: { sources, dataAsOf } };
      } catch (error) {
        if (error instanceof ServiceError) return failure(error.code, error.message);
        console.error(`Tool ${name} failed:`, error);
        return failure('INTERNAL_ERROR', 'The tool failed unexpectedly.');
      }
    },
  };
}
