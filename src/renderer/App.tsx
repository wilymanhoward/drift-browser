import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  Volume2,
  VolumeX,
  CircleAlert,
  Shield,
  Settings as SettingsIcon,
  Pin,
  Moon,
  Search,
  Star,
  Menu as MenuIcon,
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
import Settings from './Settings';
import FindBar from './FindBar';
import { ExtensionActions, ExtensionsButton } from './Extensions';
import { NEW_TAB_URL, SETTINGS_URL, isWebURL } from '../shared/navigation';

declare global {
  interface Window {
    drift: DriftAPI;
  }
}
function Favicon({ tab }: { tab: TabState }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (tab.loading) return <LoaderCircle size={16} className="spinner" />;
  if (tab.url === SETTINGS_URL) return <SettingsIcon size={16} />;
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
  const cardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cardOpen = useRef(false);
  const resizing = useRef(false);
  const splitting = useRef(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
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
  // The main process hides the auto-hide toolbar once the cursor leaves it,
  // since its drag region never reports hover here.
  const showTopbar = () => {
    void window.drift.sidebar({ topbar: true }).catch(report);
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
      clearTimeout(cardTimer.current);
    };
  }, []);
  const topInset = state?.topInset;
  // Before paint, so the chrome starts moving in the same frame as the bar.
  useLayoutEffect(() => {
    if (topInset !== undefined)
      document.documentElement.style.setProperty('--topinset', `${topInset}px`);
  }, [topInset]);
  const autoHide =
    state?.settings.toolbarLayout === 'top' && state.settings.autoHideTopBar;
  useLayoutEffect(() => {
    // Eases --topinset only while the bar auto-hides, in step with the page.
    document.documentElement.toggleAttribute('data-topbar-slide', !!autoHide);
  }, [autoHide]);
  const pageURL = state?.url;
  const overlayOpen = state?.overlay;
  useEffect(() => {
    let live = true;
    if (!pageURL || !isWebURL(pageURL)) {
      setBookmarkId(null);
      return;
    }
    void window.drift
      .getLibrary()
      .then((library) => {
        if (live)
          setBookmarkId(
            library.bookmarks.find((b) => b.url === pageURL)?.id ?? null,
          );
      })
      .catch(() => {
        if (live) setBookmarkId(null);
      });
    return () => {
      live = false;
    };
  }, [pageURL, overlayOpen]);
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
  const addressLabel = (() => {
    if (state.url === NEW_TAB_URL) return 'Search or type a URL';
    try {
      return new URL(state.url).hostname || state.url;
    } catch {
      return state.url;
    }
  })();
  const toggleBookmark = () => {
    if (!isWebURL(state.url)) {
      action('show-bookmarks');
      return;
    }
    void window.drift
      .bookmark(
        bookmarkId
          ? { type: 'remove', id: bookmarkId }
          : {
              type: 'save',
              url: state.url,
              title: state.title || state.url,
              folder: 'Bookmarks',
            },
      )
      .then(() => window.drift.getLibrary())
      .then((library) =>
        setBookmarkId(
          library.bookmarks.find((b) => b.url === state.url)?.id ?? null,
        ),
      )
      .catch(report);
  };
  const firstRegular = visibleTabs.findIndex((t) => !t.pinned);
  const hasEssentials = visibleTabs.some((t) => t.pinned);
  const topLayout = state.settings.toolbarLayout === 'top';
  const menuButton = (
    <button
      className="browser-menu-trigger"
      aria-label="Browser menu"
      title="Browser menu"
      aria-haspopup="menu"
      aria-expanded={state.overlay === 'menu'}
      onClick={() => action('show-menu')}
    >
      <MenuIcon size={16} />
    </button>
  );
  // Windows-style caption buttons; close turns red on hover, as on Windows 11.
  const windowControls = (
    <div className="window-controls" role="group" aria-label="Window">
      <button
        aria-label="Minimize window"
        title="Minimize"
        onClick={() => action('minimize')}
      >
        <Minus size={15} strokeWidth={1.5} />
      </button>
      <button
        aria-label={state.maximized ? 'Restore window' : 'Maximize window'}
        title={state.maximized ? 'Restore' : 'Maximize'}
        onClick={() => action('maximize')}
      >
        {state.maximized ? (
          <Copy size={12} strokeWidth={1.5} />
        ) : (
          <Square size={11.5} strokeWidth={1.5} />
        )}
      </button>
      <button
        className="close"
        aria-label="Close window"
        title="Close"
        onClick={() => action('close')}
      >
        <X size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
  // Back, forward and reload share one glass capsule, as macOS groups toolbar buttons.
  const navigation = (
    <div className="capsule" role="group" aria-label="Navigation">
      <button
        aria-label="Back"
        title="Back"
        disabled={!state.canGoBack}
        onClick={() => action('back')}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        aria-label="Forward"
        title="Forward"
        disabled={!state.canGoForward}
        onClick={() => action('forward')}
      >
        <ArrowRight size={16} />
      </button>
      <button
        aria-label="Reload"
        title="Reload"
        onClick={() => action('reload')}
      >
        <RotateCw size={15} />
      </button>
    </div>
  );
  const addressButton = (
    <button
      className="url-pill"
      aria-label="Edit web address"
      title={state.url}
      onClick={() => action('open-command')}
    >
      <Search size={14} />
      <span>{addressLabel}</span>
    </button>
  );
  const bookmarkButton = (
    <button
      className="bookmark-star"
      aria-label={bookmarkId ? 'Remove bookmark' : 'Bookmark this page'}
      title={bookmarkId ? 'Remove bookmark' : 'Bookmark this page'}
      aria-pressed={bookmarkId !== null}
      onClick={toggleBookmark}
    >
      <Star size={14} fill={bookmarkId ? 'currentColor' : 'none'} />
    </button>
  );
  const sidebarPin = !state.settings.lockCollapsed && (
    <button
      className="sidebar-pin"
      aria-label={state.sidebar.pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
      title={state.sidebar.pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
      aria-pressed={state.sidebar.pinned}
      onClick={() => updateSidebar({ pinned: !state.sidebar.pinned })}
    >
      {state.sidebar.pinned ? (
        <PanelLeftClose size={16} />
      ) : (
        <PanelLeftOpen size={16} />
      )}
    </button>
  );

  const error = inputError || state.error || state.storageError;
  const title = (tab: TabState) =>
    tab.title || (tab.loading ? 'Opening page…' : tab.url || 'No page open');
  // The hover card waits half a second, then follows the cursor from tab to tab
  // without waiting again. The main process draws it over the page.
  const hoverCard = (id: string, row: HTMLElement) => {
    clearTimeout(cardTimer.current);
    if (dragged.current) return;
    const send = () => {
      const aside = sidebar.current?.getBoundingClientRect();
      if (!aside || !row.isConnected) return;
      cardOpen.current = true;
      void window.drift
        .tabCard({
          id,
          top: Math.round(row.getBoundingClientRect().top),
          edge: Math.round(
            state.sidebarPosition === 'right' ? aside.left : aside.right,
          ),
        })
        .catch(() => undefined);
    };
    if (cardOpen.current) send();
    else cardTimer.current = setTimeout(send, 500);
  };
  const dismissCard = (delay = 0) => {
    clearTimeout(cardTimer.current);
    const hide = () => {
      cardOpen.current = false;
      void window.drift.tabCard(null).catch(() => undefined);
    };
    if (!cardOpen.current) return;
    if (delay) cardTimer.current = setTimeout(hide, delay);
    else hide();
  };
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
      {state.compact && !state.htmlFullscreen && (
        <div
          className="compact-edge"
          style={{ [state.sidebarPosition]: 0 }}
          onMouseEnter={() => updateSidebar({ expanded: true })}
        />
      )}
      {topLayout &&
        state.settings.autoHideTopBar &&
        !state.topbarVisible &&
        !state.htmlFullscreen && (
          <div className="topbar-hot" onMouseEnter={showTopbar} />
        )}
      {topLayout && (
        <div
          className="topbar"
          role="toolbar"
          aria-label="Browser toolbar"
          hidden={state.htmlFullscreen}
          data-hidden={!state.topbarVisible || undefined}
          inert={!state.topbarVisible}
        >
          {navigation}
          <div className="address">
            {addressButton}
            {bookmarkButton}
          </div>
          <ExtensionActions state={state} alignment="bottom left" />
          {state.extensions && (
            <div className="capsule" role="group" aria-label="Extensions menu">
              <ExtensionsButton />
            </div>
          )}
          <div className="capsule" role="group" aria-label="Sidebar">
            {sidebarPin}
          </div>
          <div className="capsule">{menuButton}</div>
          {windowControls}
        </div>
      )}
      <aside
        ref={sidebar}
        aria-label="Browser sidebar"
        className={`${expanded ? 'expanded' : 'collapsed'}${state.compact ? ' floating' : ''}`}
        style={{
          position: state.compact ? 'fixed' : 'relative',
          zIndex: 2,
          visibility:
            state.htmlFullscreen ||
            (state.compact && !expanded && !state.overlay)
              ? 'hidden'
              : 'visible',
          right: state.sidebarPosition === 'right' ? 0 : undefined,
          width: expanded ? state.sidebar.width : state.settings.collapsedWidth,
          marginLeft: state.sidebarPosition === 'right' ? 'auto' : 0,
        }}
        onMouseEnter={() => {
          clearTimeout(hover.current);
          if (
            !expanded &&
            (state.compact ||
              (state.settings.hoverExpand && !state.settings.lockCollapsed))
          )
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
        {!topLayout && (
          <>
            <header>
              {expanded && navigation}
              {windowControls}
            </header>
            <div className="sidebar-menu-trigger">{menuButton}</div>
            {expanded ? (
              <div className="address">
                {addressButton}
                {bookmarkButton}
              </div>
            ) : (
              <button
                className="rail-search"
                aria-label="Edit web address"
                title="Search or enter an address"
                onClick={() => action('open-command')}
              >
                <Search size={16} />
              </button>
            )}
            <ExtensionActions
              state={state}
              alignment={
                state.sidebarPosition === 'right'
                  ? 'bottom left'
                  : 'bottom right'
              }
            />
          </>
        )}
        {!hasEssentials && (
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
              title="Essentials: drop a tab here to keep it"
              onClick={() => tabCommand({ type: 'pin', id: state.activeTabId })}
            >
              <Pin size={14} />
              {expanded && <span>Drop a tab here to keep it</span>}
            </button>
          </div>
        )}
        <div
          role="tablist"
          aria-label="Open tabs"
          aria-orientation="vertical"
          aria-owns={visibleTabs.map((tab) => `tab-${tab.id}`).join(' ')}
        />
        <div className="tabs" onScroll={() => dismissCard()}>
          {visibleTabs.map((tab, index) => [
            expanded && index === firstRegular && (
              <div className="workspace-label" key="workspace-label">
                <span aria-hidden="true">{workspace.icon}</span>
                <span>{workspace.name}</span>
              </div>
            ),
            <div
              key={tab.id}
              role="presentation"
              className={`tab-row ${tab.id === state.activeTabId ? 'active' : ''} ${tab.pinned ? 'essential' : 'regular'} ${tab.unloaded ? 'sleeping' : ''}`}
              data-tab-id={tab.id}
              draggable
              onMouseEnter={(event) => hoverCard(tab.id, event.currentTarget)}
              onMouseLeave={() => dismissCard(120)}
              onMouseDown={() => dismissCard()}
              onDragStart={(event) => {
                dismissCard();
                dragged.current = tab.id;
                event.dataTransfer.setData('text/plain', tab.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={(event) => {
                // Nothing in Drift took the drop; if it landed outside this
                // window, the tab moves to another window.
                if (
                  dragged.current === tab.id &&
                  event.dataTransfer.dropEffect === 'none'
                )
                  tabCommand({ type: 'detach', id: tab.id });
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
                id={`tab-${tab.id}`}
                aria-selected={tab.id === state.activeTabId}
                tabIndex={tab.id === state.activeTabId ? 0 : -1}
                aria-label={title(tab)}
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
            </div>,
          ])}
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
            aria-label="Settings"
            title={`Settings (${state.settings.shortcuts['show-settings']})`}
            onClick={() => action('show-settings')}
          >
            <SettingsIcon size={16} />
          </button>
          {expanded && state.workspaces.length > 1 && (
            <div className="workspace-switcher" aria-label="Workspaces">
              {state.workspaces.map((w) => (
                <button
                  key={w.id}
                  title={w.name}
                  aria-label={`Workspace ${w.name}`}
                  aria-pressed={w.id === workspace.id}
                  style={{
                    color: w.id === workspace.id ? w.accent : undefined,
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
            </div>
          )}
          {!topLayout && state.extensions && <ExtensionsButton />}
          <button
            aria-label="Shields"
            title="Shields"
            onClick={() => action('show-shields')}
          >
            <Shield size={16} />
          </button>
          {!topLayout && expanded && sidebarPin}
        </footer>
        <span role="status" className="sr-only">
          {state.loading
            ? 'Loading page…'
            : state.error
              ? 'Unable to load page'
              : 'Ready'}
        </span>
        {expanded && (
          <div
            role="separator"
            tabIndex={0}
            aria-label="Sidebar width"
            aria-orientation="vertical"
            aria-valuemin={208}
            aria-valuemax={360}
            aria-valuenow={state.sidebar.width}
            className="resize-handle"
            style={{
              right: state.sidebarPosition === 'left' ? 0 : undefined,
              left: state.sidebarPosition === 'right' ? 0 : undefined,
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                updateSidebar({
                  width: Math.max(
                    208,
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
                    208,
                    Math.min(
                      360,
                      Math.round(
                        state.sidebarPosition === 'left'
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
      {state.find && !state.overlay && <FindBar state={state} />}
      {state.split &&
        !state.htmlFullscreen &&
        !state.overlay &&
        !state.compactPreview && (
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
              left: `calc(${(state.sidebarPosition === 'left' ? (state.compact ? 6 : expanded ? state.sidebar.width : state.settings.collapsedWidth) : 0) + (!state.compact && state.settings.contentInset ? 8 : 0)}px + (100vw - ${(state.compact ? 6 : expanded ? state.sidebar.width : state.settings.collapsedWidth) + (!state.compact && state.settings.contentInset ? 16 : 0) + 8}px) * ${state.split.ratio})`,
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
                const x = (state.sidebarPosition === 'left' ? side : 0) + inset;
                void window.drift
                  .splitRatio(
                    Math.max(
                      0.2,
                      Math.min(
                        0.8,
                        (e.clientX - x) /
                          (window.innerWidth - side - inset * 2 - 8),
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
      {state.settings.contentShadow &&
        state.settings.contentInset &&
        !state.compact &&
        !state.htmlFullscreen && (
          <div
            className="content-shadow"
            style={{
              top: 'calc(var(--topinset) + 8px)',
              bottom: 8,
              left:
                8 +
                (state.sidebarPosition === 'left'
                  ? expanded
                    ? state.sidebar.width
                    : state.settings.collapsedWidth
                  : 0),
              right:
                8 +
                (state.sidebarPosition === 'right'
                  ? expanded
                    ? state.sidebar.width
                    : state.settings.collapsedWidth
                  : 0),
              borderRadius: state.settings.radius,
            }}
          />
        )}
      {state.url === SETTINGS_URL &&
        (!state.overlay || state.overlay === 'menu') && (
          <div
            className="settings-dialog settings-page"
            role="main"
            aria-label="Settings"
            style={{
              top:
                state.compact || !state.settings.contentInset
                  ? 'var(--topinset)'
                  : 'calc(var(--topinset) + 8px)',
              bottom: state.compact || !state.settings.contentInset ? 0 : 8,
              left:
                (state.compact
                  ? 6
                  : state.sidebarPosition === 'left'
                    ? expanded
                      ? state.sidebar.width
                      : state.settings.collapsedWidth
                    : 0) +
                (!state.compact && state.settings.contentInset ? 8 : 0),
              right:
                (state.sidebarPosition === 'right' && !state.compact
                  ? expanded
                    ? state.sidebar.width
                    : state.settings.collapsedWidth
                  : 0) +
                (!state.compact && state.settings.contentInset ? 8 : 0),
            }}
          >
            <div className="dialog-content">
              <Settings state={state} />
            </div>
          </div>
        )}
      {overlay && <Overlay key={overlay.kind} event={overlay} state={state} />}
    </>
  );
}
