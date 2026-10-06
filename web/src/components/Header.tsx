import { Logo } from './Logo.js';

export function Header({ canReset, onNewChat }: { canReset: boolean; onNewChat: () => void }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <Logo />
          <span className="brand-name">Hubcast</span>
          <span className="brand-tagline">Weather risk for your hubs</span>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={onNewChat}
          disabled={!canReset}
        >
          New chat
        </button>
      </div>
    </header>
  );
}
