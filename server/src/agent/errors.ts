/** The agent could not produce a valid answer. The message is safe to show to API clients. */
export class AgentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AgentError';
  }
}
