import type { z } from 'zod';

/** One-line description of Zod issues, e.g. `hubIds.0: Unknown hub ID: x; year: Invalid input`. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
