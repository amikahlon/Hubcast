import { ChatRequestSchema, ChatResponseSchema } from '@hubcast/shared';
import { Router } from 'express';
import { AgentError, type ChatService } from '../agent/chat.js';
import { HttpError, parseRequest, sendValidated } from './http.js';

// POST /chat is the start of the AI flow: route -> chat -> agent -> tools -> services.
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
