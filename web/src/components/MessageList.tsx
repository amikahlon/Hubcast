import type { Hub } from '@hubcast/shared';
import { useEffect, useRef } from 'react';
import type { ChatMessage, ChatState } from '../hooks/useChat.js';
import { AssistantMessage } from './AssistantMessage.js';

function Message({
  message,
  hubs,
  canRetry,
  onRetry,
}: {
  message: ChatMessage;
  hubs: ReadonlyMap<string, Hub>;
  canRetry: boolean;
  onRetry: () => void;
}) {
  switch (message.role) {
    case 'user':
      return (
        <div className="message message-user">
          <p>{message.text}</p>
        </div>
      );
    case 'assistant':
      return <AssistantMessage response={message.response} hubs={hubs} />;
    case 'error':
      return (
        <div className="message message-error" role="alert">
          <p>{message.message}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={onRetry}
            disabled={!canRetry}
          >
            Try again
          </button>
        </div>
      );
  }
}

export function MessageList({
  state,
  hubs,
  onRetry,
}: {
  state: ChatState;
  hubs: ReadonlyMap<string, Hub>;
  onRetry: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const loading = state.status === 'loading';

  // Keep the newest message in view. A new answer is shown from its start, so the user reads
  // it from the top; other messages are shown at their end.
  useEffect(() => {
    const last = listRef.current?.lastElementChild;
    if (!(last instanceof HTMLElement)) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    last.scrollIntoView({
      block: last.dataset['role'] === 'assistant' ? 'start' : 'end',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [state.messages.length, loading]);

  return (
    <ol ref={listRef} className="messages" aria-label="Conversation" aria-live="polite">
      {state.messages.map((message) => (
        <li key={message.id} className="messages-item" data-role={message.role}>
          <Message message={message} hubs={hubs} canRetry={!loading} onRetry={onRetry} />
        </li>
      ))}
      {loading && (
        <li className="messages-item" data-role="loading">
          <div className="message message-assistant message-loading" role="status">
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="loading-text">Checking the data…</span>
          </div>
        </li>
      )}
    </ol>
  );
}
