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
  History,
  Bookmark,
  Shield,
  Settings as SettingsIcon,
  Download,
  PanelsTopLeft,
  Columns2,
  Minimize2,
  Pin,
  Moon,
} from 'lucide-react';
import type {
  BrowserAction,
  BrowserState,
  DriftAPI,
  SidebarUpdate,
  TabCommand,
  TabState,
  OverlayEvent,
} from '../shared/browser';
import Overlay from './Overlay';
import { NEW_TAB_URL } from '../shared/navigation';

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
  const latestState = useRef<BrowserState | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayEvent | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const hover = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragged = useRef<string | null>(null);
  const resizing = useRef(false);
  const splitting = useRef(false);
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
      latestState.current = next;
      if (next.overlay) clearTimeout(hover.current);
      setState(next);
    });
    const unsubscribeOverlay = window.drift.onOverlay(setOverlay);
    void window.drift
      .getState()
      .then((next) => {
        if (!received) {
          latestState.current = next;
          setState(next);
        }
      })
      .catch(report);
    return () => {
      unsubscribe();
      unsubscribeOverlay();
      clearTimeout(hover.current);
    };
  }, []);
  useEffect(() => {
    setInputError(null);
  }, [state?.url, state?.activeTabId]);
  useEffect(() => {
    if (!state?.overlay) setOverlay(null);
  }, [state?.overlay]);
  if (!state)
    return (
      <aside aria-label="Browser sidebar">
        <p role="status">Opening Drift…</p>
        {inputError && <p role="alert">{inputError}</p>}
      </aside>
    );
  const expanded = state.sidebar.expanded;
  const visibleTabs = state.tabs
    .filter((t) => t.workspaceId === state.activeWorkspaceId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const workspace = state.workspaces.find(
    (w) => w.id === state.activeWorkspaceId,
  )!;
  const error = inputError || state.error || state.storageError;
  const title = (tab: TabState) =>
    tab.title || (tab.loading ? 'Opening page…' : tab.url || 'No page open');
  const collapse = () => {
    clearTimeout(hover.current);
    hover.current = setTimeout(() => {
      const current = latestState.current;
      if (
        current &&
        !current.overlay &&
        (current.compact || !current.sidebar.pinned) &&
        !resizing.current &&
        !sidebar.current?.matches(':hover') &&
        (current.compact || !sidebar.current?.contains(document.activeElement))
      )
        updateSidebar({ expanded: false });
    }, 300);
  };
  return (
    <>
      {state.compactPreview?.map((frame, i) => (
        <img
          key={i}
          className="compact-preview"
          onMouseEnter={collapse}
          style={{
            left: frame.bounds.x,
            top: frame.bounds.y,
            width: frame.bounds.width,
            height: frame.bounds.height,
          }}
          src={frame.snapshot}
          alt=""
        />
      ))}
      {state.compact && (
        <div
          className="compact-edge"
          style={{ [state.settings.sidebarPosition]: 0 }}
          onMouseEnter={() => updateSidebar({ expanded: true })}
        />
      )}
      <aside
        ref={sidebar}
        aria-label="Browser sidebar"
        className={expanded ? 'expanded' : 'collapsed'}
        style={{
          position: state.compact ? 'fixed' : 'relative',
          zIndex: 2,
          visibility:
            state.compact && !expanded && !state.overlay ? 'hidden' : 'visible',
          right: state.settings.sidebarPosition === 'right' ? 0 : undefined,
          background: 'var(--chrome-bg)',
          width: expanded ? state.sidebar.width : state.settings.collapsedWidth,
          marginLeft: state.settings.sidebarPosition === 'right' ? 'auto' : 0,
        }}
        onMouseEnter={() => {
          clearTimeout(hover.current);
          if (!expanded && (state.settings.hoverExpand || state.compact))
            hover.current = setTimeout(
              () => updateSidebar({ expanded: true }),
              150,
            );
        }}
        onMouseLeave={(event) => {
          const header = event.currentTarget
            .querySelector('header')
            ?.getBoundingClientRect();
          // Electron drag regions can report an exit while the cursor is still in the header.
          if (
            header &&
            event.clientX >= header.left &&
            event.clientX < header.right &&
            event.clientY >= header.top &&
            event.clientY < header.bottom
          )
            return;
          collapse();
        }}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            !event.currentTarget.matches(':hover')
          ) {
            collapse();
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
              aria-label={
                state.maximized ? 'Restore window' : 'Maximize window'
              }
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
        <button
          className={expanded ? 'url-pill' : ''}
          aria-label="Edit web address"
          title={state.url}
          onClick={() => action('open-command')}
        >
          <Globe size={17} />
          {expanded && (
            <span>
              {state.url === NEW_TAB_URL
                ? 'New tab'
                : new URL(state.url).hostname}
            </span>
          )}
        </button>
        <div className="tab-tools">
          <button
            className="new-tab"
            aria-label="New tab"
            title={`New tab (${state.settings.shortcuts['new-tab']})`}
            onClick={() => action('new-tab')}
          >
            <Plus size={17} />
            <span>New tab</span>
          </button>
        </div>
        <div
          className="essentials-drop"
          onDragOver={(e) => {
            if (dragged.current) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const tab = state.tabs.find((t) => t.id === dragged.current);
            if (tab && !tab.pinned) tabCommand({ type: 'pin', id: tab.id });
            dragged.current = null;
          }}
        >
          <button
            aria-label={
              state.tabs.find((t) => t.id === state.activeTabId)?.pinned
                ? 'Unpin current tab'
                : 'Pin current tab'
            }
            title="Essentials · drop a tab here to pin"
            onClick={() => tabCommand({ type: 'pin', id: state.activeTabId })}
          >
            <Pin size={14} />
            {expanded && <span>Essentials</span>}
          </button>
        </div>
        <div
          className="tabs"
          role="tablist"
          aria-label="Open tabs"
          aria-orientation="vertical"
        >
          {visibleTabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`tab-row ${tab.id === state.activeTabId ? 'active' : ''} ${tab.pinned ? 'essential' : 'regular'} ${tab.unloaded ? 'sleeping' : ''}`}
              style={
                tab.id === state.activeTabId
                  ? { boxShadow: `inset 3px 0 ${workspace.accent}` }
                  : undefined
              }
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
                  const source = state.tabs.find(
                    (t) => t.id === dragged.current,
                  );
                  if (source && source.pinned !== tab.pinned)
                    tabCommand({ type: 'pin', id: source.id });
                  tabCommand({
                    type: 'move',
                    id: dragged.current,
                    index: state.tabs.findIndex((t) => t.id === tab.id),
                  });
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
                      index: state.tabs.findIndex(
                        (t) =>
                          t.id ===
                          visibleTabs[
                            Math.max(
                              0,
                              Math.min(
                                visibleTabs.length - 1,
                                index + (event.key === 'ArrowUp' ? -1 : 1),
                              ),
                            )
                          ].id,
                      ),
                    });
                    return;
                  }
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? visibleTabs.length - 1
                        : event.key === 'ArrowUp'
                          ? (index - 1 + visibleTabs.length) %
                            visibleTabs.length
                          : event.key === 'ArrowDown'
                            ? (index + 1) % visibleTabs.length
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    tabCommand({ type: 'select', id: visibleTabs[next].id });
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
                {tab.unloaded && <Moon size={12} aria-label="Sleeping" />}
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
        <div className="workspace-switcher" aria-label="Workspaces">
          {state.workspaces.map((w) => (
            <button
              key={w.id}
              title={w.name}
              aria-label={`Workspace ${w.name}`}
              aria-pressed={w.id === workspace.id}
              style={{
                borderBottom:
                  w.id === workspace.id
                    ? `3px solid ${w.accent}`
                    : '3px solid transparent',
              }}
              onClick={() => {
                void window.drift
                  .workspace({ type: 'select', id: w.id })
                  .catch(report);
              }}
            >
              {w.icon}
            </button>
          ))}
          <button
            aria-label="Manage workspaces"
            title="Manage workspaces"
            onClick={() => action('show-workspaces')}
          >
            <PanelsTopLeft size={16} />
          </button>
        </div>
        <div className="power-tools">
          <button
            aria-label="Toggle compact mode"
            title={`Compact mode (${state.settings.shortcuts.compact})`}
            aria-pressed={state.compact}
            onClick={() => action('compact')}
          >
            <Minimize2 size={16} />
          </button>
          <button
            aria-label="Toggle split view"
            title={`Split view (${state.settings.shortcuts.split})`}
            disabled={visibleTabs.length < 2}
            aria-pressed={!!state.split}
            onClick={() => action('split')}
          >
            <Columns2 size={16} />
          </button>
          <button
            aria-label="Downloads"
            title={`Downloads (${state.settings.shortcuts['show-downloads']})`}
            onClick={() => action('show-downloads')}
          >
            <Download size={16} />
          </button>
        </div>
        <footer>
          <button
            aria-label="Settings"
            title={`Settings (${state.settings.shortcuts['show-settings']})`}
            onClick={() => action('show-settings')}
          >
            <SettingsIcon size={16} />
          </button>
          <button
            aria-label="Shields"
            title="Shields"
            onClick={() => action('show-shields')}
          >
            <Shield size={16} />
          </button>
          <button
            aria-label="Reopen closed tab"
            title={`Reopen closed tab (${state.settings.shortcuts['reopen-tab']})`}
            disabled={!state.canReopen}
            onClick={() => action('reopen-tab')}
          >
            <Undo2 size={16} />
          </button>
          <button
            aria-label="History"
            title={`History (${state.settings.shortcuts['show-history']})`}
            onClick={() => action('show-history')}
          >
            <History size={16} />
          </button>
          <button
            aria-label="Bookmarks"
            title={`Bookmarks (${state.settings.shortcuts['show-bookmarks']})`}
            onClick={() => action('show-bookmarks')}
          >
            <Bookmark size={16} />
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
            style={{
              right: state.settings.sidebarPosition === 'left' ? 0 : undefined,
              left: state.settings.sidebarPosition === 'right' ? 0 : undefined,
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                updateSidebar({
                  width: Math.max(
                    220,
                    Math.min(
                      360,
                      state.sidebar.width +
                        (event.key === 'ArrowRight' ? 8 : -8),
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
                  width: Math.max(
                    220,
                    Math.min(
                      360,
                      Math.round(
                        state.settings.sidebarPosition === 'left'
                          ? event.clientX
                          : window.innerWidth - event.clientX,
                      ),
                    ),
                  ),
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
      {state.split && !state.overlay && !state.compactPreview && (
        <div
          role="separator"
          aria-label="Split view width"
          aria-orientation="vertical"
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={Math.round(state.split.ratio * 100)}
          tabIndex={0}
          className="split-divider"
          style={{
            left: `calc(${state.settings.sidebarPosition === 'left' ? (state.compact ? 6 : expanded ? state.sidebar.width : state.settings.collapsedWidth) : state.compact ? 0 : state.settings.contentInset ? 8 : 0}px + (100vw - ${(state.compact ? 6 : expanded ? state.sidebar.width : state.settings.collapsedWidth) + (!state.compact && state.settings.contentInset ? 8 : 0) + 8}px) * ${state.split.ratio})`,
          }}
          onPointerDown={(e) => {
            splitting.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (splitting.current) {
              const side = state.compact
                ? 6
                : expanded
                  ? state.sidebar.width
                  : state.settings.collapsedWidth;
              const inset =
                !state.compact && state.settings.contentInset ? 8 : 0;
              const x =
                state.settings.sidebarPosition === 'left' ? side : inset;
              void window.drift
                .splitRatio(
                  Math.max(
                    0.2,
                    Math.min(
                      0.8,
                      (e.clientX - x) / (window.innerWidth - side - inset - 8),
                    ),
                  ),
                )
                .catch(report);
            }
          }}
          onPointerUp={(e) => {
            splitting.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            splitting.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              void window.drift
                .splitRatio(
                  Math.max(
                    0.2,
                    Math.min(
                      0.8,
                      state.split!.ratio +
                        (e.key === 'ArrowRight' ? 0.05 : -0.05),
                    ),
                  ),
                )
                .catch(report);
            }
          }}
        />
      )}
      {state.settings.contentShadow && state.settings.contentInset && (
        <div
          className="content-shadow"
          style={{
            top: 8,
            bottom: 8,
            left:
              state.settings.sidebarPosition === 'left'
                ? expanded
                  ? state.sidebar.width
                  : state.settings.collapsedWidth
                : 8,
            right:
              state.settings.sidebarPosition === 'right'
                ? expanded
                  ? state.sidebar.width
                  : state.settings.collapsedWidth
                : 8,
            borderRadius: state.settings.radius,
          }}
        />
      )}
      {overlay && <Overlay key={overlay.kind} event={overlay} state={state} />}
    </>
  );
}
