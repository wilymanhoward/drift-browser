import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Settings as GeneralIcon,
  Paintbrush,
  PanelsTopLeft,
  Home,
  Search,
  Shield,
  Keyboard,
  Code2,
  SlidersHorizontal,
  X,
  Import as ImportIcon,
} from 'lucide-react';
import type { BrowserState, BrowserAction } from '../shared/browser';
import type { Settings as Preferences } from '../shared/settings';
import Workspaces from './Workspaces';
import Shields from './Shields';
import BrowserImport from './BrowserImport';

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="preference-row">
      <span>
        <span className="preference-label">{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}
export default function Settings({ state }: { state: BrowserState }) {
  const [draft, setDraft] = useState(state.settings);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('general');
  const [query, setQuery] = useState('');
  const content = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const signature = JSON.stringify(state.settings);
  useEffect(() => setDraft(state.settings), [signature]);
  useEffect(() => {
    content.current?.scrollTo(0, 0);
  }, [category, query]);
  useEffect(() => {
    search.current?.focus();
  }, []);
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
  const tool = async (action: BrowserAction) => {
    try {
      if (!action.startsWith('zoom-')) await window.drift.closeOverlay();
      await window.drift.action(action);
    } catch {
      setError('The browser action could not be completed.');
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
  const choice = (
    key:
      | 'theme'
      | 'sidebarPosition'
      | 'density'
      | 'startup'
      | 'searchEngine'
      | 'toolbarLayout',
    label: string,
    options: readonly (string | readonly [string, string])[],
  ) => (
    <Field label={label}>
      <select
        aria-label={label}
        value={draft[key]}
        onChange={(e) => void update({ [key]: e.target.value })}
      >
        {options.map((option) => {
          const [value, text] =
            typeof option === 'string' ? [option, option] : option;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </Field>
  );
  const number = (
    key:
      | 'collapsedWidth'
      | 'expandedWidth'
      | 'radius'
      | 'unloadMinutes'
      | 'maxAwakeTabs',
    label: string,
    min: number,
    max: number,
  ) => (
    <Field label={label}>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={draft[key]}
        onChange={(e) => void update({ [key]: Number(e.target.value) })}
      />
    </Field>
  );
  const toggle = (
    key:
      | 'glassEffect'
      | 'contentInset'
      | 'contentShadow'
      | 'hoverExpand'
      | 'lockCollapsed'
      | 'autoHideTopBar',
    label: string,
    hint?: string,
  ) => (
    <label className="toggle-preference">
      <input
        type="checkbox"
        aria-label={label}
        checked={draft[key]}
        onChange={(e) => void update({ [key]: e.target.checked })}
      />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
  const sections = [
    {
      id: 'browser-import',
      label: 'Import from browser',
      icon: ImportIcon,
      description:
        'Bring bookmarks, compatible preferences and extensions into Drift.',
      keywords:
        'import migration browser chrome edge brave vivaldi opera firefox zen chromium bookmarks preferences extensions',
      body: <BrowserImport privateWindow={state.privateWindow} />,
    },
    {
      id: 'general',
      label: 'General',
      icon: GeneralIcon,
      description: 'Make Drift work the way you browse.',
      keywords: 'startup restore session new tab behavior',
      body: (
        <div className="settings-card settings-fields">
          {choice('startup', 'Startup', [
            ['restore', 'Restore session'],
            ['new-tab', 'New tab'],
          ])}
          <p className="panel-note">
            Your preferences save automatically and apply without restarting.
          </p>
        </div>
      ),
    },
    {
      id: 'appearance',
      label: 'Look and feel',
      icon: Paintbrush,
      description: 'A quieter frame around the web.',
      keywords:
        'appearance theme dark light system accent color glass transparency density sidebar position width corner radius inset shadow hover toolbar layout zen safari address top bar hide collapsed minimized lock',
      body: (
        <>
          <h2>Toolbar</h2>
          <div className="settings-card settings-fields">
            {choice('toolbarLayout', 'Toolbar layout', [
              ['sidebar', 'Sidebar (Zen)'],
              ['top', 'Top bar (Safari)'],
            ])}
            {draft.toolbarLayout === 'top' &&
              toggle(
                'autoHideTopBar',
                'Auto-hide top bar',
                'Show the toolbar only while the pointer is at the top of the window.',
              )}
          </div>
          <h2>Appearance</h2>
          <div className="settings-card settings-fields">
            {choice('theme', 'Theme', ['system', 'light', 'dark'])}
            <Field label="Accent">
              <input
                type="color"
                aria-label="Accent"
                value={draft.accent}
                onChange={(e) => void update({ accent: e.target.value })}
              />
            </Field>
            {toggle(
              'glassEffect',
              'Glass effect',
              'Tinted backdrop and frosted controls. Turn off for an opaque appearance.',
            )}
            {choice('density', 'Density', ['comfortable', 'compact'])}
            {number('radius', 'Corner radius', 0, 20)}
            {toggle('contentInset', 'Inset web content')}
            {toggle('contentShadow', 'Content shadow')}
          </div>
          <h2>Sidebar</h2>
          <div className="settings-card settings-fields">
            {choice('sidebarPosition', 'Sidebar position', ['left', 'right'])}
            {number('collapsedWidth', 'Collapsed width', 40, 80)}
            {number('expandedWidth', 'Expanded width', 208, 360)}
            {toggle('hoverExpand', 'Expand sidebar on hover')}
            {toggle(
              'lockCollapsed',
              'Keep sidebar collapsed',
              'Never expand the sidebar, by hover or by pinning. Turn off to expand it again.',
            )}
          </div>
        </>
      ),
    },
    {
      id: 'tabs',
      label: 'Tabs and workspaces',
      icon: PanelsTopLeft,
      description: 'Keep your browsing spaces organised.',
      keywords:
        'tab management workspace personal work study icon accent pinned essentials unload sleeping timeout minutes',
      body: (
        <>
          <h2>Tab unloader</h2>
          <div className="settings-card settings-fields">
            <p className="panel-note">
              Inactive pages sleep to save memory. Active, pinned, split and
              audible tabs stay awake. Beyond the awake limit, the least
              recently used background tabs sleep right away, and idle tabs
              sleep early when the computer is low on memory.
            </p>
            {number('unloadMinutes', 'Unload minutes', 1, 1440)}
            {number('maxAwakeTabs', 'Background tabs kept awake', 1, 50)}
          </div>
          <h2>Workspaces</h2>
          <div className="settings-card">
            <Workspaces state={state} />
          </div>
        </>
      ),
    },
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      description: 'A calm place to start a new tab.',
      keywords: 'home new tab wallpaper image background favorites clock glass',
      body: (
        <div className="settings-card settings-fields">
          <h2>New tab background</h2>
          <p className="panel-note">
            Choose a local picture for the frosted home page and sidebar.
            Without a picture, Drift uses your system backdrop where available.
          </p>
          <div
            className="wallpaper-preview"
            style={{
              backgroundImage: draft.wallpaper
                ? `url("${draft.wallpaper}")`
                : undefined,
            }}
          >
            <span>
              {draft.wallpaper ? 'Your wallpaper' : 'Default backdrop'}
            </span>
          </div>
          <div className="dialog-actions">
            <button
              className="text-button"
              onClick={() => void file('wallpaper')}
            >
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
          <p className="panel-note">
            The clock and saved favourites stay local. Searches use your chosen
            engine.
          </p>
        </div>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      description: 'Choose where your searches go.',
      keywords:
        'search engine google duckduckgo brave startpage custom url query address',
      body: (
        <div className="settings-card settings-fields">
          {choice('searchEngine', 'Search engine', [
            'google',
            'duckduckgo',
            'brave',
            'startpage',
            'custom',
          ])}
          {draft.searchEngine === 'custom' && (
            <Field
              label="Search URL"
              hint="Use {query} where your search text should go."
            >
              <input
                aria-label="Custom search URL"
                value={draft.customSearch}
                onChange={(e) =>
                  setDraft({ ...draft, customSearch: e.target.value })
                }
                onBlur={() => void update({ customSearch: draft.customSearch })}
              />
            </Field>
          )}
        </div>
      ),
    },
    {
      id: 'privacy',
      label: 'Privacy and security',
      icon: Shield,
      description: 'Review protection for the current page.',
      keywords:
        'privacy security shields ads trackers fingerprint cookies https dns cloudflare quad9 permissions clear data private window',
      body: (
        <div className="settings-card">
          <Shields />
        </div>
      ),
    },
    {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      icon: Keyboard,
      description: 'Keep your favourite actions close at hand.',
      keywords: 'keyboard shortcuts rebind ctrl alt shift keys bindings',
      body: (
        <div className="settings-card settings-fields">
          <p className="panel-note">
            Use Ctrl, Alt, Shift, letters, digits, comma, =, -, Tab, or F1–F12.
            Bindings must be unique.
          </p>
          {Object.entries(draft.shortcuts).map(([key, value]) => (
            <Field key={key} label={key}>
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
            </Field>
          ))}
        </div>
      ),
    },
    {
      id: 'tools',
      label: 'Browser tools',
      icon: SlidersHorizontal,
      description: 'The occasional tools, kept out of your sidebar.',
      keywords:
        'browser tools history bookmarks downloads find print reopen compact split fullscreen zoom',
      body: (
        <div className="settings-card">
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
                aria-label={label}
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
                <span>{label}</span>
                {state.settings.shortcuts[action] && (
                  <kbd>{state.settings.shortcuts[action]}</kbd>
                )}
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
        </div>
      ),
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: Code2,
      description: 'Customise the details and keep a backup.',
      keywords: 'advanced custom css import export json settings backup',
      body: (
        <>
          <h2>Custom CSS</h2>
          <div className="settings-card settings-fields">
            <p className="panel-note">
              CSS can hide controls or load external resources. Use !important
              when needed to override existing rules. Export a backup before
              changing it.
            </p>
            <textarea
              aria-label="Custom CSS"
              rows={8}
              value={draft.customCSS}
              onChange={(e) =>
                setDraft({ ...draft, customCSS: e.target.value })
              }
            />
            <button
              className="text-button"
              onClick={() => void update({ customCSS: draft.customCSS })}
            >
              Apply CSS
            </button>
          </div>
          <h2>Import and export</h2>
          <div className="settings-card">
            <div className="dialog-actions">
              <button
                className="text-button"
                onClick={() => void file('export')}
              >
                Export settings
              </button>
              <button
                className="text-button"
                onClick={() => void file('import')}
              >
                Import settings
              </button>
            </div>
            <p className="panel-note">
              Imported settings replace current preferences after validation.
            </p>
          </div>
        </>
      ),
    },
  ];
  const term = query.trim().toLowerCase();
  const visible = term
    ? sections.filter((s) =>
        `${s.label} ${s.keywords}`.toLowerCase().includes(term),
      )
    : sections.filter((s) => s.id === category);
  return (
    <div className="settings-shell">
      <nav className="settings-navigation" aria-label="Settings categories">
        <div className="settings-brand">
          Drift <span>Settings</span>
        </div>
        <div className="settings-search">
          <Search size={16} />
          <input
            ref={search}
            aria-label="Find in Settings"
            placeholder="Find in Settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              aria-label="Clear settings search"
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="settings-category-list">
          {sections.map((section) => (
            <button
              key={section.id}
              className="settings-category"
              aria-current={
                !term && category === section.id ? 'page' : undefined
              }
              onClick={() => {
                setCategory(section.id);
                setQuery('');
              }}
            >
              <section.icon size={18} />
              <span>{section.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main ref={content} className="settings-main" aria-label="Preferences">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {term && (
          <header className="settings-page-heading">
            <h1>Search results</h1>
            <p>
              {visible.length
                ? `Settings matching “${query.trim()}”.`
                : 'No settings found. Try a different word.'}
            </p>
          </header>
        )}
        {visible.map((section) => (
          <section
            key={section.id}
            aria-label={section.label}
            className="settings-section"
          >
            <header className="settings-page-heading">
              {term ? <h2>{section.label}</h2> : <h1>{section.label}</h1>}
              <p>{section.description}</p>
            </header>
            {section.body}
          </section>
        ))}
      </main>
    </div>
  );
}
