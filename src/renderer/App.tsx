import { useEffect, useRef, useState } from 'react';
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
  Plus,
  PanelLeftOpen,
  PanelLeftClose,
  Undo2,
  Volume2,
  VolumeX,
  CircleAlert,
} from 'lucide-react';
import type {
  BrowserAction,
  BrowserState,
  DriftAPI,
  SidebarUpdate,
  TabCommand,
  TabState,
} from '../shared/browser';

declare global {
  interface Window {
    drift: DriftAPI;
  }
}
function Favicon({ tab }: { tab: TabState }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (tab.loading) return <LoaderCircle size={16} className="spinner" />;
  if (tab.favicon && failed !== tab.favicon)
    return (
      <img
        className="favicon"
        src={tab.favicon}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(tab.favicon)}
      />
    );
  return <Globe size={16} />;
}
export default function App() {
  const [state, setState] = useState<BrowserState | null>(null);
  const [address, setAddress] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [focusAddress, setFocusAddress] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const hover = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragged = useRef<string | null>(null);
  const resizing = useRef(false);
  const report = () => setInputError('The action could not be completed.');
  const action = (name: BrowserAction) => {
    void window.drift.action(name).catch(report);
  };
  const tabCommand = (command: TabCommand) => {
    void window.drift.tab(command).catch(report);
  };
  const updateSidebar = (update: SidebarUpdate) => {
    void window.drift.sidebar(update).catch(report);
  };
  useEffect(() => {
    let received = false;
    const unsubscribe = window.drift.onState((next) => {
      received = true;
      setState(next);
    });
    const unsubscribeFocus = window.drift.onFocusAddress(() =>
      setFocusAddress(true),
    );
    void window.drift
      .getState()
      .then((next) => {
        if (!received) setState(next);
      })
      .catch(report);
    return () => {
      unsubscribe();
      unsubscribeFocus();
      clearTimeout(hover.current);
    };
  }, []);
  useEffect(() => {
    setAddress(state?.url ?? '');
    setInputError(null);
  }, [state?.url, state?.activeTabId]);
  useEffect(() => {
    if (focusAddress && state?.sidebar.expanded) {
      input.current?.focus();
      input.current?.select();
      setFocusAddress(false);
    }
  }, [focusAddress, state?.sidebar.expanded]);
  if (!state)
    return (
      <aside aria-label="Browser sidebar">
        <p role="status">Opening Drift…</p>
        {inputError && <p role="alert">{inputError}</p>}
      </aside>
    );
  const expanded = state.sidebar.expanded;
  const error = inputError || state.error || state.storageError;
  const title = (tab: TabState) =>
    tab.title || (tab.loading ? 'Opening page…' : tab.url || 'No page open');
  const collapse = () => {
    clearTimeout(hover.current);
    if (
      !state.sidebar.pinned &&
      !resizing.current &&
      !sidebar.current?.contains(document.activeElement)
    )
      updateSidebar({ expanded: false });
  };
  return (
    <aside
      ref={sidebar}
      aria-label="Browser sidebar"
      className={expanded ? 'expanded' : 'collapsed'}
      style={{ width: expanded ? state.sidebar.width : 48 }}
      onMouseEnter={() => {
        clearTimeout(hover.current);
        if (!expanded)
          hover.current = setTimeout(
            () => updateSidebar({ expanded: true }),
            150,
          );
      }}
      onMouseLeave={collapse}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(':hover')
        ) {
          clearTimeout(hover.current);
          if (!state.sidebar.pinned && !resizing.current)
            updateSidebar({ expanded: false });
        }
      }}
    >
      <header>
        <span className="wordmark">{expanded ? 'Drift' : 'D'}</span>
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
      <div className="sidebar-toggle">
        <button
          aria-label={
            state.sidebar.pinned ? 'Unpin sidebar' : 'Pin sidebar open'
          }
          title={state.sidebar.pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          aria-pressed={state.sidebar.pinned}
          onClick={() => updateSidebar({ pinned: !state.sidebar.pinned })}
        >
          {state.sidebar.pinned ? (
            <PanelLeftClose size={17} />
          ) : (
            <PanelLeftOpen size={17} />
          )}
        </button>
      </div>
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
      {expanded ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setInputError(null);
            void window.drift
              .navigate(address)
              .catch(() =>
                setInputError('Enter a valid HTTP or HTTPS address.'),
              );
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
      ) : (
        <button
          aria-label="Edit web address"
          title={state.url}
          onClick={() => {
            updateSidebar({ expanded: true });
            setFocusAddress(true);
          }}
        >
          <Globe size={17} />
        </button>
      )}
      <div className="tab-tools">
        <button
          className="new-tab"
          aria-label="New tab"
          title="New tab (Ctrl+T)"
          onClick={() => action('new-tab')}
        >
          <Plus size={17} />
          <span>New tab</span>
        </button>
      </div>
      <div
        className="tabs"
        role="tablist"
        aria-label="Open tabs"
        aria-orientation="vertical"
      >
        {state.tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab-row ${tab.id === state.activeTabId ? 'active' : ''}`}
            data-tab-id={tab.id}
            draggable
            onDragStart={(event) => {
              dragged.current = tab.id;
              event.dataTransfer.setData('text/plain', tab.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              dragged.current = null;
            }}
            onDragOver={(event) => {
              if (dragged.current) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged.current) {
                tabCommand({ type: 'move', id: dragged.current, index });
                dragged.current = null;
              }
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                tabCommand({ type: 'close', id: tab.id });
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              tabCommand({ type: 'menu', id: tab.id });
            }}
          >
            <button
              role="tab"
              aria-selected={tab.id === state.activeTabId}
              aria-label={title(tab)}
              title={title(tab)}
              className="tab-select"
              onClick={() => tabCommand({ type: 'select', id: tab.id })}
              onKeyDown={(event) => {
                if (
                  event.key === 'ContextMenu' ||
                  (event.shiftKey && event.key === 'F10')
                ) {
                  event.preventDefault();
                  tabCommand({ type: 'menu', id: tab.id });
                  return;
                }
                if (
                  event.altKey &&
                  ['ArrowUp', 'ArrowDown'].includes(event.key)
                ) {
                  event.preventDefault();
                  tabCommand({
                    type: 'move',
                    id: tab.id,
                    index: Math.max(
                      0,
                      Math.min(
                        state.tabs.length - 1,
                        index + (event.key === 'ArrowUp' ? -1 : 1),
                      ),
                    ),
                  });
                  return;
                }
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? state.tabs.length - 1
                      : event.key === 'ArrowUp'
                        ? (index - 1 + state.tabs.length) % state.tabs.length
                        : event.key === 'ArrowDown'
                          ? (index + 1) % state.tabs.length
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  tabCommand({ type: 'select', id: state.tabs[next].id });
                  const buttons =
                    sidebar.current?.querySelectorAll<HTMLButtonElement>(
                      '[role=tab]',
                    );
                  buttons?.[next]?.focus();
                }
              }}
            >
              <Favicon tab={tab} />
              <span className="tab-title">{title(tab)}</span>
            </button>
            {(tab.audible || tab.muted) && (
              <button
                className="audio"
                aria-label={`${tab.muted ? 'Unmute' : 'Mute'} ${title(tab)}`}
                title={tab.muted ? 'Unmute tab' : 'Mute tab'}
                onClick={() => tabCommand({ type: 'mute', id: tab.id })}
              >
                {tab.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
            <button
              className="tab-close"
              aria-label={`Close ${title(tab)}`}
              title="Close tab"
              onClick={() => tabCommand({ type: 'close', id: tab.id })}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      {error &&
        (expanded ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <button
            className="error"
            aria-label={error}
            title={error}
            onClick={() => updateSidebar({ expanded: true })}
          >
            <CircleAlert size={17} />
          </button>
        ))}
      <footer>
        <button
          aria-label="Reopen closed tab"
          title="Reopen closed tab (Ctrl+Shift+T)"
          disabled={!state.canReopen}
          onClick={() => action('reopen-tab')}
        >
          <Undo2 size={16} />
        </button>
        <span role="status">
          {state.loading
            ? 'Loading page…'
            : state.error
              ? 'Unable to load page'
              : 'Ready'}
        </span>
      </footer>
      {expanded && (
        <div
          role="separator"
          tabIndex={0}
          aria-label="Sidebar width"
          aria-orientation="vertical"
          aria-valuemin={220}
          aria-valuemax={360}
          aria-valuenow={state.sidebar.width}
          className="resize-handle"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              updateSidebar({
                width: Math.max(
                  220,
                  Math.min(
                    360,
                    state.sidebar.width + (event.key === 'ArrowRight' ? 8 : -8),
                  ),
                ),
              });
            }
          }}
          onPointerDown={(event) => {
            resizing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (resizing.current)
              updateSidebar({
                width: Math.max(220, Math.min(360, Math.round(event.clientX))),
              });
          }}
          onPointerUp={(event) => {
            resizing.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            resizing.current = false;
          }}
        />
      )}
    </aside>
  );
}
