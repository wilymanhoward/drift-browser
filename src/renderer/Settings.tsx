import { useEffect, useState } from 'react';
import type { BrowserState, BrowserAction } from '../shared/browser';
import type { Settings as Preferences } from '../shared/settings';
export default function Settings({ state }: { state: BrowserState }) {
  const [draft, setDraft] = useState(state.settings);
  const [error, setError] = useState('');
  const signature = JSON.stringify(state.settings);
  const tool = async (action: BrowserAction) => {
    try {
      if (!action.startsWith('zoom-')) await window.drift.closeOverlay();
      await window.drift.action(action);
    } catch {
      setError('The browser action could not be completed.');
    }
  };
  useEffect(() => setDraft(state.settings), [signature]);
  const update = async (patch: Partial<Preferences>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      await window.drift.settings(next);
      setError('');
    } catch {
      setError(
        'Settings were not saved. Check values and use unique shortcuts.',
      );
    }
  };
  const file = async (mode: 'import' | 'export' | 'wallpaper') => {
    try {
      await window.drift.settingsFile(mode);
      setError('');
    } catch {
      setError(
        'The settings file could not be used. JSON must match the settings schema; images must be PNG, JPEG, or WebP under 3 MB.',
      );
    }
  };
  return (
    <div className="settings-form preferences">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <details className="browser-tools">
        <summary>Browser tools</summary>
        <div className="browser-tool-actions">
          {(
            [
              ['History', 'show-history'],
              ['Bookmarks', 'show-bookmarks'],
              ['Downloads', 'show-downloads'],
              ['Workspaces', 'show-workspaces'],
              ['Find in page', 'find'],
              ['Print page', 'print'],
              ['Reopen closed tab', 'reopen-tab'],
              ['Toggle compact mode', 'compact'],
              ['Toggle split view', 'split'],
              ['Toggle fullscreen', 'fullscreen'],
            ] as const
          ).map(([label, action]) => (
            <button
              key={action}
              className="text-button"
              disabled={
                (action === 'reopen-tab' && !state.canReopen) ||
                (action === 'split' &&
                  state.tabs.filter(
                    (t) => t.workspaceId === state.activeWorkspaceId,
                  ).length < 2)
              }
              aria-pressed={
                action === 'compact'
                  ? state.compact
                  : action === 'split'
                    ? !!state.split
                    : undefined
              }
              onClick={() => void tool(action)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="zoom-tools" aria-label="Page zoom">
          <span>Page zoom</span>
          <button
            aria-label="Zoom out"
            disabled={state.zoomPercent <= 25}
            onClick={() => void tool('zoom-out')}
          >
            −
          </button>
          <button
            className="zoom-value"
            aria-label={`Reset zoom (${state.zoomPercent}%)`}
            onClick={() => void tool('zoom-reset')}
          >
            {state.zoomPercent}%
          </button>
          <button
            aria-label="Zoom in"
            disabled={state.zoomPercent >= 300}
            onClick={() => void tool('zoom-in')}
          >
            +
          </button>
        </div>
      </details>
      <h2>Appearance</h2>
      <label>
        Theme
        <select
          aria-label="Theme"
          value={draft.theme}
          onChange={(e) =>
            void update({ theme: e.target.value as Preferences['theme'] })
          }
        >
          {['system', 'light', 'dark'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Accent
        <input
          type="color"
          aria-label="Accent"
          value={draft.accent}
          onChange={(e) => void update({ accent: e.target.value })}
        />
      </label>
      <label>
        Sidebar position
        <select
          aria-label="Sidebar position"
          value={draft.sidebarPosition}
          onChange={(e) =>
            void update({ sidebarPosition: e.target.value as 'left' | 'right' })
          }
        >
          <option>left</option>
          <option>right</option>
        </select>
      </label>
      <label>
        Collapsed width
        <input
          aria-label="Collapsed width"
          type="number"
          min={40}
          max={80}
          value={draft.collapsedWidth}
          onChange={(e) =>
            void update({ collapsedWidth: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Expanded width
        <input
          aria-label="Expanded width"
          type="number"
          min={220}
          max={360}
          value={draft.expandedWidth}
          onChange={(e) =>
            void update({ expandedWidth: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Density
        <select
          aria-label="Density"
          value={draft.density}
          onChange={(e) =>
            void update({ density: e.target.value as Preferences['density'] })
          }
        >
          <option>comfortable</option>
          <option>compact</option>
        </select>
      </label>
      <label>
        Corner radius
        <input
          aria-label="Corner radius"
          type="number"
          min={0}
          max={20}
          value={draft.radius}
          onChange={(e) => void update({ radius: Number(e.target.value) })}
        />
      </label>
      {(['contentInset', 'contentShadow', 'hoverExpand'] as const).map(
        (key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(e) => void update({ [key]: e.target.checked })}
            />
            {
              {
                contentInset: 'Inset web content',
                contentShadow: 'Content shadow',
                hoverExpand: 'Expand sidebar on hover',
              }[key]
            }
          </label>
        ),
      )}
      <div>
        <button className="text-button" onClick={() => void file('wallpaper')}>
          Choose wallpaper
        </button>
        <button
          className="text-button"
          disabled={!draft.wallpaper}
          onClick={() => void update({ wallpaper: '' })}
        >
          Remove wallpaper
        </button>
      </div>
      <h2>Behavior</h2>
      <label>
        Startup
        <select
          aria-label="Startup"
          value={draft.startup}
          onChange={(e) =>
            void update({ startup: e.target.value as Preferences['startup'] })
          }
        >
          <option value="restore">Restore session</option>
          <option value="new-tab">New tab</option>
        </select>
      </label>
      <label>
        Search engine
        <select
          aria-label="Search engine"
          value={draft.searchEngine}
          onChange={(e) =>
            void update({
              searchEngine: e.target.value as Preferences['searchEngine'],
            })
          }
        >
          {['google', 'duckduckgo', 'brave', 'startpage', 'custom'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {draft.searchEngine === 'custom' && (
        <label>
          Search URL
          <input
            aria-label="Custom search URL"
            value={draft.customSearch}
            onChange={(e) =>
              setDraft({ ...draft, customSearch: e.target.value })
            }
            onBlur={() => void update({ customSearch: draft.customSearch })}
          />
        </label>
      )}
      <label>
        Unload inactive tabs after minutes
        <input
          aria-label="Unload minutes"
          type="number"
          min={1}
          max={1440}
          value={draft.unloadMinutes}
          onChange={(e) =>
            void update({ unloadMinutes: Number(e.target.value) })
          }
        />
      </label>
      <h2>Keyboard shortcuts</h2>
      <p>
        Use Ctrl, Alt, Shift, letters, digits, comma, =, -, Tab, or F1–F12.
        Bindings must be unique.
      </p>
      {Object.entries(draft.shortcuts).map(([key, value]) => (
        <label key={key}>
          {key}
          <input
            aria-label={`Shortcut ${key}`}
            value={value}
            onChange={(e) =>
              setDraft({
                ...draft,
                shortcuts: { ...draft.shortcuts, [key]: e.target.value },
              })
            }
            onBlur={() => void update({ shortcuts: draft.shortcuts })}
          />
        </label>
      ))}
      <h2>Custom CSS</h2>
      <p>
        Advanced: CSS can hide controls or load external resources. Use
        !important when needed to override existing rules. Export a backup
        before changing it.
      </p>
      <textarea
        aria-label="Custom CSS"
        value={draft.customCSS}
        onChange={(e) => setDraft({ ...draft, customCSS: e.target.value })}
        rows={6}
      />
      <button
        className="text-button"
        onClick={() => void update({ customCSS: draft.customCSS })}
      >
        Apply CSS
      </button>
      <h2>Import and export</h2>
      <div>
        <button className="text-button" onClick={() => void file('export')}>
          Export settings
        </button>
        <button className="text-button" onClick={() => void file('import')}>
          Import settings
        </button>
      </div>
      <p>
        Changes apply without restarting. Imported settings replace current
        preferences after validation.
      </p>
    </div>
  );
}
