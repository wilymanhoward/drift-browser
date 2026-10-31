import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Puzzle } from 'lucide-react';
import type { BrowserState } from '../shared/browser';
import type { ExtensionCommand } from '../shared/extensions';

// Extensions run in the profile's page session, not the chrome UI's.
const PARTITION = 'persist:drift';
interface ActionDetails {
  title?: string;
  text?: string;
  color?: string;
  iconModified?: number;
}
interface ActionState {
  activeTabId?: number;
  actions: (ActionDetails & {
    id: string;
    tabs: Record<string, ActionDetails>;
  })[];
}
// Exposed by electron-chrome-extensions' browser-action preload.
interface BrowserActionAPI {
  getState(partition: string): Promise<ActionState>;
  activate(
    partition: string,
    details: {
      eventType: 'click' | 'contextmenu';
      extensionId: string;
      tabId: number;
      alignment: string;
      anchorRect: { x: number; y: number; width: number; height: number };
    },
  ): Promise<void>;
  addEventListener(name: 'update', listener: (state: ActionState) => void): void;
  removeEventListener(
    name: 'update',
    listener: (state: ActionState) => void,
  ): void;
  addObserver(partition: string): void;
  removeObserver(partition: string): void;
}
declare global {
  interface Window {
    browserAction?: BrowserActionAPI;
  }
}

// Toolbar buttons for extensions with an action; clicking opens the
// extension's popup or sends it the click, as in Chrome.
export function ExtensionActions({
  state,
  alignment,
}: {
  state: BrowserState;
  alignment: 'bottom left' | 'bottom right';
}) {
  const [actions, setActions] = useState<ActionState | null>(null);
  const available = !!state.extensions?.available;
  useEffect(() => {
    const api = window.browserAction;
    if (!api || !available) return;
    let live = true;
    const update = (next: ActionState) => {
      if (live) setActions(next);
    };
    api.addEventListener('update', update);
    api.addObserver(PARTITION);
    void api
      .getState(PARTITION)
      .then(update)
      .catch(() => {});
    return () => {
      live = false;
      api.removeEventListener('update', update);
      api.removeObserver(PARTITION);
    };
  }, [available]);
  if (!state.extensions || !actions) return null;
  const shown = state.extensions.extensions.filter((e) => !e.hidden);
  const visible = actions.actions.filter((a) =>
    shown.some((e) => e.id === a.id),
  );
  if (!visible.length) return null;
  const tabId = actions.activeTabId ?? -1;
  const activate = (
    event: MouseEvent<HTMLButtonElement>,
    extensionId: string,
  ) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    void window.browserAction
      ?.activate(PARTITION, {
        eventType: event.type === 'contextmenu' ? 'contextmenu' : 'click',
        extensionId,
        tabId,
        alignment,
        anchorRect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      })
      .catch(() => {});
  };
  return (
    <div
      className="capsule extension-actions"
      role="group"
      aria-label="Extensions"
    >
      {visible.map((action) => {
        const info = { ...action, ...action.tabs[tabId] };
        const name =
          info.title || shown.find((e) => e.id === action.id)?.name || '';
        const params = new URLSearchParams({
          tabId: String(tabId),
          partition: PARTITION,
          ...(info.iconModified ? { t: String(info.iconModified) } : {}),
        });
        return (
          <button
            key={action.id}
            aria-label={name}
            title={name}
            onClick={(event) => activate(event, action.id)}
            onContextMenu={(event) => activate(event, action.id)}
          >
            <img
              src={`crx://extension-icon/${action.id}/32/2?${params}`}
              alt=""
              draggable={false}
            />
            {info.text && (
              <span
                className="extension-badge"
                style={{ background: info.color || 'var(--accent)' }}
              >
                {info.text}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ExtensionsButton() {
  return (
    <button
      aria-label="Extensions"
      title="Extensions"
      onClick={() => void window.drift.action('show-extensions')}
    >
      <Puzzle size={16} />
    </button>
  );
}

export function ExtensionsPanel({ state }: { state: BrowserState }) {
  const [error, setError] = useState('');
  const run = async (command: ExtensionCommand) => {
    try {
      await window.drift.extension(command);
      setError('');
    } catch {
      setError('That did not work. Try again, or restart Drift.');
    }
  };
  if (!state.extensions)
    return (
      <p className="panel-note">
        Extensions don’t run in private windows. Open a regular window to use
        or manage them.
      </p>
    );
  const { extensions } = state.extensions;
  return (
    <div className="extension-list">
      <div className="dialog-actions">
        <button
          className="text-button primary"
          onClick={() => void run({ type: 'store' })}
        >
          Get extensions from the Chrome Web Store
        </button>
      </div>
      {(error || state.extensions.error) && (
        <p className="error" role="alert">
          {error || state.extensions.error}
        </p>
      )}
      {!extensions.length && (
        <p role="status" className="panel-note">
          No extensions yet. Open the Chrome Web Store and choose Add to
          Chrome on any extension to install it in Drift.
        </p>
      )}
      {extensions.map((extension) => (
        <section
          key={extension.id}
          className="extension-row"
          aria-label={extension.name}
        >
          {extension.icon ? (
            <img className="extension-icon" src={extension.icon} alt="" />
          ) : (
            <span className="extension-icon">
              <Puzzle size={18} />
            </span>
          )}
          <div className="extension-text">
            <h2>
              {extension.name} <span>{extension.version}</span>
            </h2>
            {extension.description && <p>{extension.description}</p>}
            <div className="dialog-actions">
              {extension.hasAction && (
                <button
                  className="text-button"
                  aria-pressed={!extension.hidden}
                  onClick={() =>
                    void run({ type: 'toggle-toolbar', id: extension.id })
                  }
                >
                  {extension.hidden ? 'Show in toolbar' : 'Hide from toolbar'}
                </button>
              )}
              {extension.hasOptions && (
                <button
                  className="text-button"
                  onClick={() => void run({ type: 'options', id: extension.id })}
                >
                  Options
                </button>
              )}
              <button
                className="text-button"
                onClick={() => void run({ type: 'remove', id: extension.id })}
              >
                Remove
              </button>
            </div>
          </div>
        </section>
      ))}
      <p className="panel-note">
        Drift runs Chrome extensions through Electron, which lacks some Chrome
        features. Ad blockers built on declarativeNetRequest (such as uBlock
        Origin Lite) and extensions that need sync, identity sign-in or
        keyboard shortcuts won’t fully work. Drift’s own Shields already block
        ads.
      </p>
    </div>
  );
}
