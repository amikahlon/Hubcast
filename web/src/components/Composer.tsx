import { MAX_MESSAGE_LENGTH } from '@hubcast/shared';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

/** Show the character counter when this close to the limit. */
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 200;

export function Composer({
  loading,
  onSend,
}: {
  loading: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const length = text.trim().length;
  const tooLong = length > MAX_MESSAGE_LENGTH;
  const canSend = !loading && length > 0 && !tooLong;

  // Grow with the text, up to the CSS max-height.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [text]);

  // Focus the input on desktop (not on phones, where it would open the keyboard).
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) textareaRef.current?.focus();
  }, []);

  function submit() {
    if (!canSend) return;
    onSend(text);
    setText('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line. Enter that confirms an input method is left alone.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-inner">
        <label htmlFor="message" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="message"
          ref={textareaRef}
          className="composer-input"
          rows={1}
          value={text}
          placeholder="Ask about weather risk…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="button button-primary composer-send" disabled={!canSend}>
          Send
        </button>
      </div>
      {length >= COUNTER_FROM && (
        <p
          className={tooLong ? 'counter counter-over' : 'counter'}
          role={tooLong ? 'alert' : undefined}
        >
          {length} / {MAX_MESSAGE_LENGTH}
        </p>
      )}
    </form>
  );
}
