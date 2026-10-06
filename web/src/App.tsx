import { useChat } from './hooks/useChat.js';
import { Composer } from './components/Composer.js';
import { EmptyState } from './components/EmptyState.js';
import { Header } from './components/Header.js';
import { MessageList } from './components/MessageList.js';
import { useHubs } from './hooks/useHubs.js';

export function App() {
  const { state, send, retry, newChat } = useChat();
  const hubs = useHubs();
  const started = state.messages.length > 0 || state.status === 'loading';

  return (
    <div className="app">
      <Header canReset={started} onNewChat={newChat} />
      <main className="main">
        <div className="column">
          {started ? (
            <MessageList state={state} hubs={hubs} onRetry={retry} />
          ) : (
            <EmptyState onAsk={send} />
          )}
        </div>
      </main>
      <Composer loading={state.status === 'loading'} onSend={send} />
    </div>
  );
}
