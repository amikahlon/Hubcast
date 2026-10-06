import { FinalAnswerSchema, buildHubIdSchema, type FinalAnswer } from '@hubcast/shared';
import { z } from 'zod';
import { AgentError } from './errors.js';

// Structured output checks the shape. We also check IDs against the real catalog.
export function createAnswerValidator(hubIds: readonly string[]) {
  const HubId = buildHubIdSchema(hubIds);

  return (response: unknown): FinalAnswer => {
    const answer = FinalAnswerSchema.safeParse(response);
    if (!answer.success) {
      console.error('Invalid final answer:', z.prettifyError(answer.error));
      throw new AgentError('The assistant returned an invalid answer.', { cause: answer.error });
    }

    const unknownHubIds = answer.data.hubIds.filter((id) => !HubId.safeParse(id).success);
    if (unknownHubIds.length > 0) {
      console.error('Final answer has unknown hub IDs:', unknownHubIds);
      throw new AgentError('The assistant returned an answer about an unknown hub.');
    }
    return answer.data;
  };
}
