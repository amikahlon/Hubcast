import type { ChatResponse } from '@hubcast/shared';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { errorMessage, sendChat } from '../api.js';

// --- Conversation state: what the chat shows, as a reducer ---

export type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; response: ChatResponse }
  | { id: number; role: 'error'; message: string };

export interface ChatState {
  /** One per chat, sent with every message so the server keeps the conversation history. */
  threadId: string;
  messages: ChatMessage[];
  /** Only one request at a time: `loading` means an answer is pending. */
  status: 'idle' | 'loading';
  nextId: number;
}

export type ChatAction =
  | { type: 'send'; text: string }
  | { type: 'retry' }
  | { type: 'received'; threadId: string; response: ChatResponse }
  | { type: 'failed'; threadId: string; message: string }
  | { type: 'newChat'; threadId: string };

export function initChat(threadId: string): ChatState {
  return { threadId, messages: [], status: 'idle', nextId: 1 };
}

/** The question to send again after an error. */
export function lastUserText(state: ChatState): string | undefined {
  return state.messages.findLast((message) => message.role === 'user')?.text;
}

/** `Omit` applied to each member of the union. */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function append(state: ChatState, message: WithoutId<ChatMessage>): ChatState {
  return {
    ...state,
    messages: [...state.messages, { ...message, id: state.nextId }],
    nextId: state.nextId + 1,
  };
}

/** Applies one action. Answers or errors that belong to an earlier chat are ignored. */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send': {
      if (state.status === 'loading' || action.text.trim() === '') return state;
      return { ...append(state, { role: 'user', text: action.text }), status: 'loading' };
    }
    case 'retry': {
      const last = state.messages.at(-1);
      if (state.status === 'loading' || last?.role !== 'error') return state;
      return { ...state, messages: state.messages.slice(0, -1), status: 'loading' };
    }
    case 'received':
    case 'failed': {
      // Ignore answers that belong to an earlier chat or that nobody is waiting for.
      if (action.threadId !== state.threadId || state.status !== 'loading') return state;
      const next =
        action.type === 'received'
          ? append(state, { role: 'assistant', response: action.response })
          : append(state, { role: 'error', message: action.message });
      return { ...next, status: 'idle' };
    }
    case 'newChat':
      return initChat(action.threadId);
  }
}

// --- Hook: connects the state to the chat API ---

/** Conversation state and actions. History lives on the server, keyed by `threadId`. */
export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, undefined, () => initChat(crypto.randomUUID()));
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const request = useCallback(async (threadId: string, text: string) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    busyRef.current = true;
    try {
      const response = await sendChat(threadId, text, controller.signal);
      dispatch({ type: 'received', threadId, response });
    } catch (error) {
      if (controller.signal.aborted) return; // New chat or unmount: nobody is waiting.
      dispatch({ type: 'failed', threadId, message: errorMessage(error) });
    } finally {
      if (controllerRef.current === controller) busyRef.current = false;
    }
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (busyRef.current || trimmed === '') return;
      dispatch({ type: 'send', text: trimmed });
      void request(state.threadId, trimmed);
    },
    [request, state.threadId],
  );

  const retry = useCallback(() => {
    const text = lastUserText(state);
    if (busyRef.current || text === undefined) return;
    dispatch({ type: 'retry' });
    void request(state.threadId, text);
  }, [request, state]);

  const newChat = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    busyRef.current = false;
    dispatch({ type: 'newChat', threadId: crypto.randomUUID() });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, send, retry, newChat };
}
