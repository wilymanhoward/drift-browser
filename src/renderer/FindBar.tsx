import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import type { BrowserState } from '../shared/browser';
export default function FindBar({ state }: { state: BrowserState }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    input.current?.focus();
    return window.drift.onFindFocus(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, []);
  const run = (command: Parameters<typeof window.drift.find>[0]) => {
    void window.drift
      .find(command)
      .catch(() => setError('Find could not be completed.'));
  };
  const side = state.compact
    ? 6
    : state.sidebar.expanded
      ? state.sidebar.width
      : state.settings.collapsedWidth;
  return (
    <form
      className="find-bar"
      aria-label="Find in page"
      style={{
        left: state.settings.sidebarPosition === 'left' ? side : 0,
        right: state.settings.sidebarPosition === 'right' ? side : 0,
      }}
      onSubmit={(e) => {
        e.preventDefault();
        run({ type: 'next', forward: true });
      }}
    >
      <label htmlFor="find-query">Find</label>
      <input
        ref={input}
        id="find-query"
        aria-label="Find text"
        maxLength={1024}
        value={state.find!.query}
        autoComplete="off"
        onChange={(e) => run({ type: 'query', query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            run({ type: 'close' });
          } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            run({ type: 'next', forward: false });
          }
        }}
      />
      <span role="status" aria-live="polite">
        {error || `${state.find!.active} of ${state.find!.matches}`}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        disabled={!state.find!.matches}
        onClick={() => run({ type: 'next', forward: false })}
      >
        <ArrowUp size={16} />
      </button>
      <button
        type="submit"
        aria-label="Next match"
        disabled={!state.find!.matches}
      >
        <ArrowDown size={16} />
      </button>
      <button
        type="button"
        aria-label="Close find"
        onClick={() => run({ type: 'close' })}
      >
        <X size={16} />
      </button>
    </form>
  );
}
