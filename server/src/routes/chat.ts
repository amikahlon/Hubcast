import { ChatRequestSchema, ChatResponseSchema } from '@hubcast/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AgentError, type ChatService } from '../agent/chat.js';
import { HttpError, parseRequest, sendValidated } from './http.js';

// POST /chat is the start of the AI flow: route -> chat -> agent -> tools -> services.
export function chatRouter(deps: { chatService: ChatService }): Router {
  const router = Router();
  // Protects the Anthropic API from basic abuse: 10 chat requests per minute per IP.
  const chatLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new HttpError(
          429,
          'RATE_LIMITED',
          'Too many requests. Please wait a minute and try again.',
        ),
      );
    },
  });
  router.post('/chat', chatLimit, async (req, res) => {
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
