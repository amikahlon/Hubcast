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

/** A tool as the agent sees it: a name, a description, an input schema and a thin `run`. */
export interface ToolHandler {
  name: ToolName;
  description: string;
  schema: z.ZodType;
  /** Validates the input, calls one service and returns `{ ok, data, meta }` or `{ ok: false, error }`. */
  run(input: unknown): ToolResult<unknown>;
}

/** What every tool needs: the services to call, the data info for `meta`, and the input schemas. */
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

/**
 * Builds a tool. The tool never throws: bad input and service errors (for example an unknown
 * year) come back as `{ ok: false, error }`, so the agent can read them and continue.
 */
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
