import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  LoaderCircle,
  Minus,
  RotateCw,
  Square,
  Copy,
  X,
} from 'lucide-react';
import type { BrowserAction, BrowserState, DriftAPI } from '../shared/browser';
import './style.css';

declare global {
  interface Window {
    drift: DriftAPI;
  }
}

function App() {
  const [state, setState] = useState<BrowserState>({
    url: '',
    title: '',
    loading: true,
    canGoBack: false,
    canGoForward: false,
    maximized: false,
    error: null,
  });
  const [address, setAddress] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let received = false;
    const unsubscribe = window.drift.onState((next) => {
      received = true;
      setState(next);
    });
    void window.drift.getState().then((next) => {
      if (!received) setState(next);
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    setAddress(state.url);
  }, [state.url]);
  const action = (name: BrowserAction) => {
    void window.drift
      .action(name)
      .catch(() => setInputError('The action could not be completed.'));
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  return (
    <aside aria-label="Browser sidebar">
      <header>
        <span className="wordmark">Drift</span>
        <div className="window-controls">
          <button
            aria-label="Minimize window"
            title="Minimize"
            onClick={() => action('minimize')}
          >
            <Minus size={13} />
          </button>
          <button
            aria-label={state.maximized ? 'Restore window' : 'Maximize window'}
            title={state.maximized ? 'Restore' : 'Maximize'}
            onClick={() => action('maximize')}
          >
            {state.maximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
          <button
            className="close"
            aria-label="Close window"
            title="Close"
            onClick={() => action('close')}
          >
            <X size={14} />
          </button>
        </div>
      </header>
      <nav aria-label="Page navigation">
        <button
          aria-label="Back"
          title="Back"
          disabled={!state.canGoBack}
          onClick={() => action('back')}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          aria-label="Forward"
          title="Forward"
          disabled={!state.canGoForward}
          onClick={() => action('forward')}
        >
          <ArrowRight size={17} />
        </button>
        <button
          aria-label="Reload"
          title="Reload"
          onClick={() => action('reload')}
        >
          <RotateCw size={16} />
        </button>
      </nav>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setInputError(null);
          void window.drift
            .navigate(address)
            .catch(() => setInputError('Enter a valid HTTP or HTTPS address.'));
        }}
      >
        <Globe size={15} aria-hidden="true" />
        <input
          ref={input}
          aria-label="Web address"
          spellCheck={false}
          value={address}
          placeholder="Enter a web address"
          onChange={(event) => setAddress(event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setAddress(state.url);
              setInputError(null);
              input.current?.blur();
            }
          }}
        />
      </form>
      <div className="current-page" aria-current="page">
        {state.loading ? (
          <LoaderCircle size={16} className="spinner" />
        ) : (
          <Globe size={16} />
        )}
        <span>
          {state.title ||
            (state.loading ? 'Opening page…' : state.url || 'No page open')}
        </span>
      </div>
      {(inputError || state.error) && (
        <p className="error" role="alert">
          {inputError || state.error}
        </p>
      )}
      <footer>
        <span className="status-dot" />
        <span role="status">
          {state.loading
            ? 'Loading page…'
            : state.error
              ? 'Unable to load page'
              : 'Ready'}
        </span>
      </footer>
    </aside>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
