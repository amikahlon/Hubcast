import { ChatRequestSchema, ChatResponseSchema } from '@hubcast/shared';
import { Router } from 'express';
import { AgentError } from '../agent/errors.js';
import type { ChatService } from '../agent/chat.js';
import { HttpError } from '../middleware/errors.js';
import { parseRequest, sendValidated } from './validation.js';

export function chatRouter(deps: { chatService: ChatService }): Router {
  const router = Router();
  router.post('/chat', async (req, res) => {
    const { threadId, message } = parseRequest(ChatRequestSchema, req.body);
    try {
      const result = await deps.chatService.chat(threadId, message);
      sendValidated(res, ChatResponseSchema, { threadId, ...result });
    } catch (error) {
      if (error instanceof AgentError) throw new HttpError(502, 'AGENT_ERROR', error.message);
      throw error;
    }
  });
  return router;
}
