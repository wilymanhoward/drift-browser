import {
  BrowserWindow,
  Menu,
  WebContentsView,
  screen,
  systemPreferences,
  nativeTheme,
} from 'electron';
import type { Input, NavigationEntry, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../shared/power';
import type { Workspace, WorkspaceCommand } from '../shared/power';
import {
  CONTENT_INSET,
  HOT_ZONE,
  TOP_BAR,
  SPLIT_TOOLBAR_HEIGHT,
  TOPBAR_SLIDE,
} from '../shared/browser';
import type {
  BrowserState,
  TabCommand,
  TabState,
  SidebarUpdate,
} from '../shared/browser';
import { DEFAULT_SIDEBAR } from './session';
import { listeners } from './listeners';
import { readDescription, readSnapshot } from './tab-card';
import type { TabCardDetails } from './tab-card';
import type { SavedSession, SavedTab } from './session';
import { PAGE_ACTIONS } from '../shared/page-tools';
import type { PageAction } from '../shared/page-tools';
import {
  isPageURL,
  isWebURL,
  navigationURL,
  NEW_TAB_URL,
  SETTINGS_URL,
} from '../shared/navigation';

interface Tab {
  previewSourceId?: string;
  view: WebContentsView;
  state: TabState;
  navigationURL: string;
  lastActive: number;
  suspended?: ClosedTab;
  unwire?: () => void;
  // Last description and preview read for the hover card; kept while asleep.
  details?: { url: string; description: string; snapshot: string | null };
}
interface ClosedTab {
  tab: SavedTab;
  index: number;
  history: NavigationEntry[];
  historyIndex: number;
}
// A tab taken out of one window, page still alive, for another to adopt.
export interface MovedTab {
  tab: Tab;
  workspaces: Workspace[];
  sidebar: { pinned: boolean; width: number };
}

export class TabManager {
  private tabs: Tab[] = [];
  private activeId = '';
  private closed: ClosedTab[] = [];
  private sidebar = { ...DEFAULT_SIDEBAR, expanded: false };
  private disposed = false;
  private overlay: BrowserState['overlay'] = null;
  private overlayVersion = 0;
  private workspaces: Workspace[] = [{ ...DEFAULT_WORKSPACE }];
  private workspaceId = DEFAULT_WORKSPACE.id;
  private compact = false;
  private compactPreview: BrowserState['compactPreview'] = null;
  private peekVersion = 0;
  private split: BrowserState['split'] = null;
  private previewClosing: {
    id: string;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private htmlFullscreen = false;
  private topbarShown = false;
  private cursorTimer: ReturnType<typeof setInterval>;
  private cursorOutside = 0;
  // Page top while the toolbar slides; null when at rest.
  private slidingTop: number | null = null;
  private slideTimer?: ReturnType<typeof setInterval>;
  private sleepTimer: ReturnType<typeof setInterval>;
  constructor(
    private win: BrowserWindow,
    private changed: () => void,
    private visited: (url: string, title: string, increment: boolean) => void,
    private environment: {
      partition: string;
      privateWindow: boolean;
      // Returns a cleanup that undoes the window-specific hooks.
      track: (page: WebContents, adopted: boolean) => () => void;
      settings: () => import('../shared/settings').Settings;
      closeFind: () => void;
      findActive: () => boolean;
      pageAction: (action: PageAction) => void;
    },
  ) {
    this.sleepTimer = setInterval(() => this.sleepInactive(), 30000);
    this.sleepTimer.unref();
    // Native page views cover the renderer and frameless edges swallow mouse
    // events, so the auto-hide toolbar follows the cursor from the main process.
    this.cursorTimer = setInterval(() => this.watchCursor(), 60);
    this.cursorTimer.unref();
  }
  private watchCursor() {
    if (
      this.disposed ||
      this.win.isDestroyed() ||
      !this.win.isVisible() ||
      this.win.isMinimized() ||
      this.htmlFullscreen ||
      this.environment.settings().toolbarLayout !== 'top' ||
      !this.environment.settings().autoHideTopBar
    )
      return;
    const point = screen.getCursorScreenPoint();
    // Content bounds, because a maximized frameless window's outer bounds
    // reach past the screen edge on Windows.
    const bounds = this.win.getContentBounds();
    const y = point.y - bounds.y;
    const inside =
      point.x >= bounds.x &&
      point.x < bounds.x + bounds.width &&
      y >= 0 &&
      y < bounds.height;
    if (!this.topbarShown) {
      if (inside && y <= 6) this.updateSidebar({ topbar: true });
      return;
    }
    // This is the only place that hides the bar: its empty space is a drag
    // region, which never reports hover to the renderer.
    if (this.overlay || (inside && y < TOP_BAR + 8)) {
      this.cursorOutside = 0;
    } else if (++this.cursorOutside > 7) {
      this.cursorOutside = 0;
      this.updateSidebar({ topbar: false });
    }
  }
  restore(saved: SavedSession | null) {
    if (saved) {
      this.workspaces = saved.workspaces ?? [{ ...DEFAULT_WORKSPACE }];
      this.workspaceId = saved.activeWorkspaceId ?? this.workspaces[0].id;
      this.sidebar = { ...saved.sidebar, expanded: saved.sidebar.pinned };
      this.activeId = saved.activeTabId;
      for (const tab of saved.tabs)
        this.create(
          tab.url,
          tab,
          false,
          undefined,
          tab.id !== saved.activeTabId && !tab.pinned,
        );
      this.select(saved.activeTabId);
    } else this.create();
  }
  get state(): Omit<
    BrowserState,
    'storageError' | 'settings' | 'dark' | 'find' | 'zoomPercent' | 'extensions'
  > {
    return {
      ...this.active.state,
      tabs: this.tabs
        .filter((tab) => !tab.previewSourceId)
        .map((tab) => ({ ...tab.state })),
      activeTabId: this.active.previewSourceId ?? this.activeId,
      maximized: this.win.isMaximized(),
      canReopen: this.closed.length > 0,
      sidebar: { ...this.sidebar },
      sidebarPosition: this.environment.settings().sidebarPosition,
      overlay: this.overlay,
      privateWindow: this.environment.privateWindow,
      workspaces: this.workspaces.map((w) => ({ ...w })),
      activeWorkspaceId: this.workspaceId,
      compact: this.compact,
      compactPreview: this.compactPreview,
      split: this.split,
      htmlFullscreen: this.htmlFullscreen,
      ...this.topbar(),
    };
  }
  get saved(): SavedSession {
    return {
      version: 1,
      tabs: this.tabs
        .filter((tab) => !tab.previewSourceId)
        .map(({ state }) => ({
          id: state.id,
          url: state.url,
          title: state.title.slice(0, 1024),
          muted: state.muted,
          workspaceId: state.workspaceId,
          pinned: state.pinned,
        })),
      activeTabId: this.active.previewSourceId ?? this.activeId,
      sidebar: { pinned: this.sidebar.pinned, width: this.sidebar.width },
      workspaces: this.workspaces,
      activeWorkspaceId: this.workspaceId,
    };
  }
  get active() {
    return this.tabs.find((tab) => tab.state.id === this.activeId)!;
  }
  idOf(page: WebContents) {
    return this.tabs.find(
      (t) => !t.state.unloaded && t.view.webContents.id === page.id,
    )?.state.id;
  }
  owns(page: WebContents) {
    return this.tabs.some(
      (t) => !t.state.unloaded && t.view.webContents.id === page.id,
    );
  }
  private emit() {
    if (!this.disposed && this.tabs.some((t) => t.state.id === this.activeId))
      this.changed();
  }
  create(
    url = NEW_TAB_URL,
    saved?: SavedTab,
    select = true,
    history?: ClosedTab,
    deferred = false,
    previewSourceId?: string,
  ): Tab {
    const target = navigationURL(url);
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: this.environment.partition,
        navigateOnDragDrop: false,
        ...(previewSourceId && {
          preload: path.join(__dirname, '../preload/preview.cjs'),
        }),
      },
    });
    const tab: Tab = {
      previewSourceId,
      view,
      navigationURL: target,
      lastActive: Date.now(),
      state: {
        id: saved?.id ?? randomUUID(),
        url: target,
        title: saved?.title ?? (target === NEW_TAB_URL ? 'New tab' : ''),
        loading: !deferred,
        canGoBack: false,
        canGoForward: false,
        error: null,
        favicon: null,
        audible: false,
        muted: saved?.muted ?? false,
        workspaceId: this.workspaces.some((w) => w.id === saved?.workspaceId)
          ? saved!.workspaceId!
          : this.workspaceId,
        pinned: saved?.pinned ?? false,
        unloaded: deferred,
      },
    };
    const page = view.webContents;
    this.tabs.push(tab);
    this.win.contentView.addChildView(view);
    view.setVisible(false);
    page.setAudioMuted(tab.state.muted);
    const update = this.wire(tab, false);
    if (deferred) {
      this.emit();
      return tab;
    }
    if (select || !this.activeId) this.select(tab.state.id);
    else this.layout();
    const loading = history?.history.length
      ? page.navigationHistory.restore({
          entries: history.history,
          index: history.historyIndex,
        })
      : page.loadURL(target);
    void loading.catch((cause) => {
      if (
        !page.isDestroyed() &&
        tab.navigationURL === target &&
        !(cause instanceof Error && cause.message.includes('ERR_ABORTED'))
      ) {
        tab.state.error =
          'This page could not be loaded. Check the address and your connection.';
        update();
      }
    });
    this.emit();
    return tab;
  }
  // Page listeners are bound to this window, so a moved tab is unwired from
  // its old window and wired again in the new one.
  private wire(tab: Tab, adopted: boolean) {
    const page = tab.view.webContents;
    const { on, off } = listeners(page);
    const untrack = this.environment.track(page, adopted);
    if (tab.previewSourceId) {
      on('dom-ready', () => this.updatePreviewControl(tab));
      on('ipc-message', (event, channel, ...args) => {
        if (event.senderFrame !== page.mainFrame || this.preview !== tab)
          return;
        if (
          channel === 'drift:close-preview' &&
          args.length === 1 &&
          typeof args[0] === 'boolean'
        )
          this.animatePreviewClose(tab, args[0]);
        else if (
          channel === 'drift:preview-close-finished' &&
          !args.length &&
          this.previewClosing?.id === tab.state.id
        )
          this.close(tab.state.id);
      });
    }
    tab.unwire = () => {
      untrack();
      off();
    };
    const update = () => {
      if (this.disposed || page.isDestroyed() || !this.tabs.includes(tab))
        return;
      tab.state = {
        ...tab.state,
        title: page.getTitle() || tab.state.title,
        loading: page.isLoading(),
        canGoBack: page.navigationHistory.canGoBack(),
        canGoForward: page.navigationHistory.canGoForward(),
        audible: page.isCurrentlyAudible(),
      };
      this.emit();
    };
    on('did-start-navigation', (_event, url, _inPlace, mainFrame) => {
      if (mainFrame) {
        tab.navigationURL = url;
        if (isPageURL(url)) tab.state.url = url;
        tab.state.error = null;
        tab.state.favicon = null;
      }
    });
    on('did-start-loading', () => {
      tab.state.error = null;
      update();
    });
    on('did-stop-loading', () => {
      update();
      if (isWebURL(tab.state.url)) void this.remember(tab, false);
    });
    on('did-navigate', (_event, url) => {
      if (isPageURL(url)) tab.state.url = url;
      this.visited(url, page.getTitle(), true);
      update();
    });
    on('did-navigate-in-page', (_event, url, mainFrame) => {
      if (mainFrame && isPageURL(url)) {
        tab.state.url = url;
        this.visited(url, page.getTitle(), true);
      }
      update();
    });
    on('page-title-updated', () => {
      this.visited(tab.state.url, page.getTitle(), false);
      update();
    });
    on('audio-state-changed', update);
    on('page-favicon-updated', (_event, urls) => {
      tab.state.favicon = urls.find(isWebURL) ?? null;
      update();
    });
    on('did-fail-load', (_event, code, _description, url, mainFrame) => {
      if (mainFrame && code !== -3 && url === tab.navigationURL) {
        tab.state.error =
          'This page could not be loaded. Check the address and your connection.';
        update();
      }
    });
    on('render-process-gone', () => {
      tab.state.error = 'The page stopped responding. Reload to try again.';
      update();
    });
    on('will-navigate', (event, url) => {
      if (page.getURL() === NEW_TAB_URL && url === `${NEW_TAB_URL}?settings`) {
        event.preventDefault();
        void this.openSettings();
      } else if (
        page.getURL() === NEW_TAB_URL &&
        url === `${NEW_TAB_URL}?add-site`
      ) {
        event.preventDefault();
        void this.openOverlay('bookmarks');
      } else if (!isPageURL(url)) event.preventDefault();
    });
    on('will-redirect', (event, url) => {
      if (!isPageURL(url)) event.preventDefault();
    });
    let splitClickAt = 0;
    on('before-mouse-event', (_event, mouse) => {
      if (mouse.type !== 'mouseDown' && mouse.type !== 'mouseUp') return;
      splitClickAt = mouse.button === 'left' ? Date.now() : 0;
    });
    page.setWindowOpenHandler(({ url, disposition }) => {
      // Chromium distinguishes modified clicks; the mouse button excludes middle-click.
      const splitLink =
        disposition === 'background-tab' && Date.now() - splitClickAt < 1000;
      splitClickAt = 0;
      if (isWebURL(url)) {
        if (splitLink) {
          this.openPreview(tab, url);
        } else this.create(url);
      }
      return { action: 'deny' };
    });
    on('before-input-event', (event, input) => {
      if (this.shortcut(input)) event.preventDefault();
    });
    on('enter-html-full-screen', () => {
      if (this.disposed) return;
      this.select(tab.state.id);
      this.environment.closeFind();
      this.htmlFullscreen = true;
      this.compactPreview = null;
      this.layout();
      this.emit();
    });
    on('leave-html-full-screen', () => {
      this.htmlFullscreen = false;
      if (!this.disposed && !this.win.isDestroyed()) {
        this.layout();
        this.emit();
      }
    });
    on('focus', () => {
      if (
        this.split?.ids.includes(tab.state.id) &&
        this.activeId !== tab.state.id
      ) {
        this.activeId = tab.state.id;
        this.environment.closeFind();
        tab.lastActive = Date.now();
        this.emit();
      }
    });
    return update;
  }
  select(id: string) {
    if (!this.tabs.some((tab) => tab.state.id === id))
      throw new Error('Unknown tab.');
    if (this.preview && !this.split?.ids.includes(id)) this.dismissPreview();
    const chosen = this.wake(id);
    const changedTab = id !== this.activeId;
    if (this.workspaceId !== chosen.state.workspaceId) this.split = null;
    if (this.split && !this.split.ids.includes(id))
      this.split.ids[this.split.ids.indexOf(this.activeId)] = id;
    this.workspaceId = chosen.state.workspaceId;
    // Idle time for the tab being left starts now, not when it was opened.
    const previous = this.tabs.find((t) => t.state.id === this.activeId);
    if (changedTab && previous) {
      previous.lastActive = Date.now();
      // Its preview is taken now, so the hover card still has one once it sleeps.
      void this.remember(previous, true);
    }
    this.activeId = id;
    if (changedTab) this.environment.closeFind();
    chosen.lastActive = Date.now();
    this.layout();
    this.emit();
    this.limitAwake();
  }
  close(id: string) {
    if (this.preview?.state.id === id) {
      this.dismissPreview();
      this.layout();
      this.emit();
      return;
    }
    if (this.preview?.previewSourceId === id) this.dismissPreview();
    const index = this.tabs.findIndex((tab) => tab.state.id === id);
    if (index < 0) throw new Error('Unknown tab.');
    const tab = this.tabs[index];
    if (this.htmlFullscreen && id === this.activeId) {
      this.htmlFullscreen = false;
      this.win.setFullScreen(false);
    }
    const page = tab.view.webContents;
    this.closed.push({
      tab: {
        id: tab.state.id,
        url: tab.state.url,
        title: tab.state.title,
        muted: tab.state.muted,
        workspaceId: tab.state.workspaceId,
        pinned: tab.state.pinned,
      },
      index,
      history: tab.suspended?.history ?? page.navigationHistory.getAllEntries(),
      historyIndex:
        tab.suspended?.historyIndex ?? page.navigationHistory.getActiveIndex(),
    });
    this.closed = this.closed.slice(-25);
    this.tabs.splice(index, 1);
    if (page && !page.isDestroyed()) {
      this.win.contentView.removeChildView(tab.view);
      page.close();
    }
    if (this.split?.ids.includes(id)) this.split = null;
    const siblings = this.tabs.filter(
      (t) => t.state.workspaceId === this.workspaceId,
    );
    if (!siblings.length) this.create();
    else if (this.activeId === id)
      this.select(siblings[Math.min(index, siblings.length - 1)].state.id);
    this.layout();
    this.emit();
  }
  reopen() {
    const closed = this.closed.pop();
    if (!closed) return;
    const tab = this.create(closed.tab.url, closed.tab, true, closed);
    this.move(tab.state.id, Math.min(closed.index, this.tabs.length - 1));
  }
  // Takes a tab out of this window without closing its page.
  detach(id: string): MovedTab {
    if (this.preview?.state.id === id)
      throw new Error('Preview pages cannot be moved.');
    if (this.preview?.previewSourceId === id) this.dismissPreview();
    const index = this.tabs.findIndex((tab) => tab.state.id === id);
    if (index < 0) throw new Error('Unknown tab.');
    const tab = this.tabs[index];
    if (this.htmlFullscreen && id === this.activeId) {
      this.htmlFullscreen = false;
      this.win.setFullScreen(false);
    }
    if (id === this.activeId) this.environment.closeFind();
    tab.unwire?.();
    if (this.win.contentView.children.includes(tab.view))
      this.win.contentView.removeChildView(tab.view);
    this.tabs.splice(index, 1);
    if (this.split?.ids.includes(id)) this.split = null;
    const siblings = this.tabs.filter(
      (t) => t.state.workspaceId === this.workspaceId,
    );
    if (!siblings.length) this.create();
    else if (this.activeId === id)
      this.select(siblings[Math.min(index, siblings.length - 1)].state.id);
    this.layout();
    this.emit();
    return {
      tab,
      workspaces: this.workspaces.map((w) => ({ ...w })),
      sidebar: { pinned: this.sidebar.pinned, width: this.sidebar.width },
    };
  }
  // Takes in a tab detached from another window. A fresh window inherits the
  // source window's workspaces; an existing one files it under the current one.
  adopt({ tab, workspaces, sidebar }: MovedTab) {
    if (!this.tabs.length) {
      this.workspaces = workspaces;
      this.workspaceId = tab.state.workspaceId;
      this.sidebar = { ...this.sidebar, ...sidebar, expanded: sidebar.pinned };
    } else tab.state.workspaceId = this.workspaceId;
    if (tab.suspended) tab.suspended.tab.workspaceId = tab.state.workspaceId;
    tab.lastActive = Date.now();
    this.tabs.push(tab);
    // A sleeping tab has no page left; selecting it wakes it in this window.
    if (tab.view.webContents && !tab.view.webContents.isDestroyed()) {
      this.win.contentView.addChildView(tab.view);
      tab.view.setVisible(false);
      this.wire(tab, true);
    }
    this.select(tab.state.id);
  }
  private move(id: string, index: number) {
    const current = this.tabs.findIndex((tab) => tab.state.id === id);
    if (current < 0 || index >= this.tabs.length)
      throw new Error('Invalid tab position.');
    this.tabs.splice(index, 0, this.tabs.splice(current, 1)[0]);
    this.emit();
  }
  command(command: TabCommand) {
    const tab = this.tabs.find((tab) => tab.state.id === command.id);
    if (!tab) throw new Error('Unknown tab.');
    const peers = this.tabs.filter(
      (t) =>
        !t.previewSourceId &&
        t.state.workspaceId === tab.state.workspaceId &&
        t.state.pinned === tab.state.pinned,
    );
    const peerIndex = peers.indexOf(tab);
    switch (command.type) {
      case 'select':
        this.select(command.id);
        break;
      case 'close':
        this.close(command.id);
        break;
      case 'move':
        this.move(command.id, command.index);
        break;
      case 'duplicate':
        this.create(tab.state.url, {
          ...tab.state,
          id: randomUUID(),
          pinned: false,
        });
        break;
      case 'pin':
        tab.state.pinned = !tab.state.pinned;
        this.emit();
        break;
      case 'sleep':
        this.sleep(tab);
        break;
      case 'split':
        this.toggleSplit(tab.state.id);
        break;
      case 'mute':
        tab.state.muted = !tab.state.muted;
        if (!tab.state.unloaded)
          tab.view.webContents.setAudioMuted(tab.state.muted);
        this.emit();
        break;
      case 'close-others':
        for (const other of [...this.tabs])
          if (
            other !== tab &&
            other.state.workspaceId === tab.state.workspaceId &&
            !other.state.pinned
          )
            this.close(other.state.id);
        break;
      case 'menu':
        Menu.buildFromTemplate([
          {
            label: tab.state.pinned ? 'Unpin tab' : 'Pin tab',
            click: () => this.command({ type: 'pin', id: command.id }),
          },
          {
            label: 'Move to workspace',
            submenu: this.workspaces.map((w) => ({
              label: w.name,
              enabled: w.id !== tab.state.workspaceId,
              click: () =>
                this.workspace({
                  type: 'move-tab',
                  id: w.id,
                  tabId: command.id,
                }),
            })),
          },
          {
            label: 'Split beside current tab',
            enabled: command.id !== this.activeId,
            click: () => this.toggleSplit(command.id),
          },
          {
            label: 'Put tab to sleep',
            enabled: this.canSleep(tab),
            click: () => this.sleep(tab),
          },
          {
            label: 'Duplicate tab',
            click: () => this.command({ type: 'duplicate', id: command.id }),
          },
          {
            label: tab.state.muted ? 'Unmute tab' : 'Mute tab',
            click: () => this.command({ type: 'mute', id: command.id }),
          },
          {
            label: 'Move up',
            enabled: peerIndex > 0,
            click: () =>
              this.move(command.id, this.tabs.indexOf(peers[peerIndex - 1])),
          },
          {
            label: 'Move down',
            enabled: peerIndex < peers.length - 1,
            click: () =>
              this.move(command.id, this.tabs.indexOf(peers[peerIndex + 1])),
          },
          { type: 'separator' },
          {
            label: 'Close other tabs',
            enabled: this.tabs.length > 1,
            click: () => this.command({ type: 'close-others', id: command.id }),
          },
          { label: 'Close tab', click: () => this.close(command.id) },
        ]).popup({ window: this.win });
        break;
    }
  }
  async navigate(input: unknown) {
    const url = navigationURL(input);
    const tab = this.active;
    tab.state.url = url;
    tab.navigationURL = url;
    tab.state.error = null;
    this.emit();
    try {
      await tab.view.webContents.loadURL(url);
    } catch (cause) {
      if (
        !tab.view.webContents.isDestroyed() &&
        tab.navigationURL === url &&
        !(cause instanceof Error && cause.message.includes('ERR_ABORTED'))
      ) {
        tab.state.error =
          'This page could not be loaded. Check the address and your connection.';
        this.emit();
      }
    }
  }
  navigation(action: 'back' | 'forward' | 'reload') {
    const page = this.active.view.webContents;
    if (action === 'reload') {
      this.active.state.error = null;
      page.reload();
    } else if (action === 'back' && page.navigationHistory.canGoBack())
      page.navigationHistory.goBack();
    else if (action === 'forward' && page.navigationHistory.canGoForward())
      page.navigationHistory.goForward();
  }
  private topbar() {
    const settings = this.environment.settings();
    const inset =
      this.compact || this.htmlFullscreen
        ? 0
        : settings.contentInset
          ? CONTENT_INSET
          : 0;
    // The sidebar layout keeps every control in the sidebar, so pages start at the top.
    const top = settings.toolbarLayout === 'top' && !this.htmlFullscreen;
    const topbarVisible = top && (!settings.autoHideTopBar || this.topbarShown);
    return {
      topbarVisible,
      topInset: !top
        ? 0
        : topbarVisible
          ? TOP_BAR
          : Math.max(0, HOT_ZONE - inset),
    };
  }
  // Moves pages with the toolbar instead of jumping. The renderer eases
  // --topinset over the same duration and curve, so the chrome keeps pace.
  private slideTop(from: number) {
    clearInterval(this.slideTimer);
    const to = this.topbar().topInset;
    this.slidingTop = null;
    if (
      from === to ||
      systemPreferences.getAnimationSettings().prefersReducedMotion
    ) {
      this.layout();
      return;
    }
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / TOPBAR_SLIDE);
      // Ease-out cubic, matching --ease-out in renderer/style.css.
      this.slidingTop =
        t < 1 ? Math.round(from + (to - from) * (1 - (1 - t) ** 3)) : null;
      if (t === 1) clearInterval(this.slideTimer);
      if (!this.disposed && !this.win.isDestroyed()) this.layout();
    };
    this.slideTimer = setInterval(step, 16);
    step();
  }
  updateSidebar(update: SidebarUpdate) {
    if (update.topbar !== undefined) {
      const from = this.slidingTop ?? this.topbar().topInset;
      const changed = this.topbarShown !== update.topbar;
      this.topbarShown = update.topbar;
      update = { ...update };
      delete update.topbar;
      // The renderer and the cursor watcher can both ask to show it.
      if (changed) this.slideTop(from);
      if (!Object.keys(update).length) {
        this.emit();
        return;
      }
    }
    if (this.environment.settings().lockCollapsed && !this.compact) {
      // Permanently collapsed: width changes are still allowed.
      if (update.pinned) update = { ...update, pinned: false };
      if (update.expanded) update = { ...update, expanded: false };
    }
    if (this.compact && update.pinned !== undefined) this.toggleCompact();
    if (this.compact && update.expanded !== undefined) {
      void this.peek(update.expanded);
      return;
    }
    this.sidebar = { ...this.sidebar, ...update };
    if (update.pinned !== undefined) this.sidebar.expanded = update.pinned;
    if (this.sidebar.pinned) this.sidebar.expanded = true;
    this.layout();
    this.emit();
  }
  async openOverlay(
    kind: NonNullable<BrowserState['overlay']>,
    newTab = false,
  ) {
    this.environment.closeFind();
    if (newTab) this.create();
    const version = ++this.overlayVersion;
    const page = this.active.view.webContents;
    this.overlay = kind;
    this.emit();
    let snapshot: string | null = null;
    try {
      snapshot = (await page.capturePage()).toDataURL();
    } catch {
      /* A page may not have rendered yet. */
    }
    if (
      this.disposed ||
      this.win.isDestroyed() ||
      version !== this.overlayVersion
    )
      return;
    for (const tab of this.tabs)
      if (!tab.state.unloaded) tab.view.setVisible(false);
    this.win.webContents.focus();
    this.win.webContents.send('drift:overlay', {
      kind,
      newTab,
      query:
        newTab || this.active.state.url === NEW_TAB_URL
          ? ''
          : this.active.state.url,
      snapshot,
      bounds: this.active.view.getBounds(),
    });
    this.emit();
  }
  closeOverlay() {
    ++this.overlayVersion;
    this.overlay = null;
    this.select(this.activeId);
    this.active.view.webContents.focus();
  }
  refreshNewTabs() {
    for (const tab of this.tabs)
      if (!tab.state.unloaded && tab.state.url === NEW_TAB_URL)
        tab.view.webContents.reload();
  }
  openSettings() {
    if (this.overlay) this.closeOverlay();
    const existing = this.tabs.find(
      (tab) =>
        tab.state.url === SETTINGS_URL &&
        tab.state.workspaceId === this.workspaceId,
    );
    if (existing) this.select(existing.state.id);
    else this.create(SETTINGS_URL);
  }
  workspace(command: WorkspaceCommand) {
    if (command.type !== 'save') this.dismissPreview();
    if (command.type === 'save') {
      const existing = this.workspaces.find((w) => w.id === command.id);
      if (command.id && !existing) throw new Error('Unknown workspace');
      if (!existing && this.workspaces.length >= 9)
        throw new Error('Up to nine workspaces are supported');
      const next = {
        id: existing?.id ?? randomUUID(),
        name: command.name.trim(),
        icon: command.icon.trim(),
        accent: command.accent,
      };
      if (existing) Object.assign(existing, next);
      else this.workspaces.push(next);
    } else {
      const workspace = this.workspaces.find((w) => w.id === command.id);
      if (!workspace) throw new Error('Unknown workspace');
      if (command.type === 'remove') {
        if (this.workspaces.length === 1)
          throw new Error('Keep at least one workspace');
        const fallback = this.workspaces.find((w) => w.id !== command.id)!;
        for (const tab of this.tabs)
          if (tab.state.workspaceId === command.id)
            tab.state.workspaceId = fallback.id;
        this.workspaces = this.workspaces.filter((w) => w !== workspace);
        if (this.workspaceId === command.id) this.workspaceId = fallback.id;
      } else if (command.type === 'move-tab') {
        const tab = this.tabs.find((t) => t.state.id === command.tabId);
        if (!tab) throw new Error('Unknown tab');
        tab.state.workspaceId = command.id;
        if (this.split?.ids.includes(tab.state.id)) this.split = null;
        if (tab.state.id === this.activeId) {
          const other = this.tabs.find(
            (t) => t.state.workspaceId === this.workspaceId,
          );
          if (other) this.select(other.state.id);
          else this.create();
        }
      } else {
        this.split = null;
        this.workspaceId = command.id;
        const tab = this.tabs.find((t) => t.state.workspaceId === command.id);
        if (tab) this.select(tab.state.id);
        else this.create();
      }
    }
    this.layout();
    this.emit();
  }
  toggleCompact() {
    this.compact = !this.compact;
    ++this.peekVersion;
    this.compactPreview = null;
    this.sidebar.expanded = this.compact ? false : this.sidebar.pinned;
    this.layout();
    this.emit();
  }
  private async peek(open: boolean) {
    const version = ++this.peekVersion;
    if (open && !this.sidebar.expanded && !this.overlay) {
      try {
        const frames = await Promise.all(
          this.tabs
            .filter((t) => !t.state.unloaded && t.view.getVisible())
            .map(async (t) => ({
              snapshot: (await t.view.webContents.capturePage()).toDataURL(),
              bounds: t.view.getBounds(),
            })),
        );
        if (version !== this.peekVersion || this.disposed || !this.compact)
          return;
        this.compactPreview = frames;
      } catch {
        return;
      }
    } else if (!open) this.compactPreview = null;
    this.sidebar.expanded = open;
    this.layout();
    this.emit();
  }
  private get preview() {
    return this.tabs.find((tab) => tab.previewSourceId);
  }
  private updatePreviewControl(tab: Tab) {
    const settings = this.environment.settings();
    tab.view.webContents.send('drift:preview-control', {
      dark:
        settings.theme === 'dark' ||
        (settings.theme === 'system' && nativeTheme.shouldUseDarkColors),
      accent: settings.accent,
      zoom: tab.view.webContents.getZoomFactor(),
      visible: !this.htmlFullscreen,
    });
  }
  private dismissPreview() {
    clearTimeout(this.previewClosing?.timer);
    this.previewClosing = null;
    const preview = this.preview;
    if (!preview) return;
    if (this.activeId === preview.state.id) {
      this.environment.closeFind();
      this.activeId = preview.previewSourceId!;
      if (this.htmlFullscreen) {
        this.htmlFullscreen = false;
        this.win.setFullScreen(false);
      }
    }
    this.split = null;
    preview.unwire?.();
    this.tabs.splice(this.tabs.indexOf(preview), 1);
    this.win.contentView.removeChildView(preview.view);
    preview.view.webContents.close();
  }
  private openPreview(source: Tab, url: string) {
    const sourceId = source.previewSourceId ?? source.state.id;
    if (this.previewClosing) this.dismissPreview();
    const existing = this.preview;
    if (existing?.previewSourceId === sourceId) {
      this.select(existing.state.id);
      void this.navigate(url);
      return;
    }
    this.dismissPreview();
    this.select(sourceId);
    const preview = this.create(
      url,
      undefined,
      false,
      undefined,
      false,
      sourceId,
    );
    this.split = {
      ids: [sourceId, preview.state.id],
      ratio: 0.5,
      preview: true,
    };
    this.layout();
    this.emit();
  }
  toggleSplit(id?: string) {
    if (this.preview) {
      this.dismissPreview();
      if (!id) {
        this.layout();
        this.emit();
        return;
      }
    }
    if (this.split && !id) this.split = null;
    else {
      const other = id
        ? this.tabs.find(
            (t) =>
              t.state.id === id && t.state.workspaceId === this.workspaceId,
          )
        : this.tabs.find(
            (t) =>
              t !== this.active && t.state.workspaceId === this.workspaceId,
          );
      if (!other || other.state.id === this.activeId) return;
      this.wake(other.state.id);
      this.split = { ids: [this.activeId, other.state.id], ratio: 0.5 };
    }
    this.layout();
    this.emit();
  }
  private animatePreviewClose(tab: Tab, reducedMotion: boolean) {
    if (this.previewClosing) return;
    if (
      reducedMotion ||
      systemPreferences.getAnimationSettings().prefersReducedMotion
    ) {
      this.close(tab.state.id);
      return;
    }
    this.previewClosing = {
      id: tab.state.id,
      timer: setTimeout(() => {
        if (this.preview === tab) this.close(tab.state.id);
      }, 300),
    };
    tab.view.webContents.send('drift:preview-close-animation', 180);
  }
  setSplitRatio(ratio: unknown) {
    if (
      typeof ratio !== 'number' ||
      !Number.isFinite(ratio) ||
      ratio < 0.2 ||
      ratio > 0.8
    )
      throw new Error('Invalid split ratio');
    if (this.split) this.split.ratio = ratio;
    this.layout();
    this.emit();
  }
  private canSleep(tab: Tab) {
    return (
      !tab.previewSourceId &&
      !tab.state.unloaded &&
      tab.state.id !== this.activeId &&
      !this.split?.ids.includes(tab.state.id) &&
      !tab.state.pinned &&
      !tab.state.audible &&
      !tab.state.loading &&
      !tab.view.webContents.isDevToolsOpened()
    );
  }
  private sleep(tab: Tab) {
    if (!this.canSleep(tab)) return;
    tab.suspended = {
      tab: { ...tab.state },
      index: this.tabs.indexOf(tab),
      history: tab.view.webContents.navigationHistory.getAllEntries(),
      historyIndex: tab.view.webContents.navigationHistory.getActiveIndex(),
    };
    tab.state.unloaded = true;
    this.win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.emit();
  }
  private sleepInactive() {
    if (this.disposed) return;
    // Under memory pressure, any background tab idle for a minute sleeps early.
    const { total, free } = process.getSystemMemoryInfo();
    const minutes =
      free / total < 0.15 ? 1 : this.environment.settings().unloadMinutes;
    const cutoff = Date.now() - minutes * 60000;
    for (const tab of this.tabs) if (tab.lastActive < cutoff) this.sleep(tab);
    this.limitAwake();
  }
  // Keeps at most maxAwakeTabs sleepable background tabs alive, least recently
  // used first to go. Loading tabs are skipped and caught on the next check.
  private limitAwake() {
    if (this.disposed) return;
    const awake = this.tabs
      .filter((tab) => this.canSleep(tab))
      .sort((a, b) => b.lastActive - a.lastActive);
    for (const tab of awake.slice(this.environment.settings().maxAwakeTabs))
      this.sleep(tab);
  }
  private wake(id: string): Tab {
    const tab = this.tabs.find((t) => t.state.id === id)!;
    if (!tab.state.unloaded) return tab;
    const index = this.tabs.indexOf(tab);
    const placeholder = tab.view.webContents;
    if (placeholder && !placeholder.isDestroyed()) {
      this.win.contentView.removeChildView(tab.view);
      placeholder.close();
    }
    this.tabs.splice(index, 1);
    const replacement = this.create(
      tab.state.url,
      { ...tab.state },
      false,
      tab.suspended,
    );
    this.tabs.splice(this.tabs.indexOf(replacement), 1);
    this.tabs.splice(index, 0, replacement);
    replacement.details = tab.details;
    return replacement;
  }
  // Reads a live page's description and, if asked, its preview. A reading that
  // fails keeps the previous one.
  private async remember(tab: Tab, snapshot: boolean) {
    const page = tab.view.webContents;
    if (tab.state.unloaded || page.isDestroyed() || !isWebURL(tab.state.url))
      return;
    const url = tab.state.url;
    const [description, image] = await Promise.all([
      readDescription(page),
      snapshot ? readSnapshot(page) : null,
    ]);
    if (tab.state.url !== url) return;
    const previous = tab.details?.url === url ? tab.details : undefined;
    tab.details = {
      url,
      description: description ?? previous?.description ?? '',
      snapshot: image ?? previous?.snapshot ?? null,
    };
  }
  // What the sidebar's hover card shows for a tab.
  async cardDetails(id: string): Promise<TabCardDetails | null> {
    const tab = this.tabs.find((t) => t.state.id === id);
    if (!tab) return null;
    // The current page is already on screen, so only other tabs get a preview.
    const active = tab.state.id === this.activeId;
    if (tab.state.url !== SETTINGS_URL && tab.state.url !== NEW_TAB_URL)
      await this.remember(tab, !active);
    if (!this.tabs.includes(tab)) return null;
    const internal =
      tab.state.url === SETTINGS_URL
        ? 'Appearance, privacy, shortcuts and other Drift preferences.'
        : tab.state.url === NEW_TAB_URL
          ? 'Start page with search and your favourites.'
          : null;
    const details =
      tab.details?.url === tab.state.url ? tab.details : undefined;
    return {
      ...tab.state,
      description: internal ?? details?.description ?? '',
      snapshot: internal || active ? null : (details?.snapshot ?? null),
      active,
      lastActive: tab.lastActive,
    };
  }
  shortcut(input: Input): boolean {
    if (
      input.type === 'keyDown' &&
      input.key === 'Escape' &&
      this.environment.findActive()
    ) {
      this.environment.closeFind();
      this.active.view.webContents.focus();
      return true;
    }
    if (
      input.type === 'keyDown' &&
      input.key === 'Escape' &&
      !this.overlay &&
      this.preview
    ) {
      this.dismissPreview();
      this.layout();
      this.emit();
      this.active.view.webContents.focus();
      return true;
    }
    if (input.type === 'keyDown') {
      const chord = [
        input.control || input.meta ? 'Ctrl' : '',
        input.alt ? 'Alt' : '',
        input.shift ? 'Shift' : '',
        input.key.length === 1
          ? input.key === ','
            ? ','
            : input.key.toUpperCase()
          : input.key,
      ]
        .filter(Boolean)
        .join('+');
      const binding = Object.entries(
        this.environment.settings().shortcuts,
      ).find(([, value]) => value.toLowerCase() === chord.toLowerCase())?.[0];
      if (PAGE_ACTIONS.includes(binding as PageAction)) {
        this.environment.pageAction(binding as PageAction);
        return true;
      }
      if (binding === 'show-settings') {
        void this.openSettings();
        return true;
      }
      if (binding === 'toggle-sidebar') {
        this.updateSidebar({ pinned: !this.sidebar.pinned });
        return true;
      }
      if (binding === 'devtools') {
        this.active.view.webContents.toggleDevTools();
        return true;
      }
      if (binding === 'compact') {
        this.toggleCompact();
        return true;
      }
      if (binding === 'split') {
        this.toggleSplit();
        return true;
      }
      if (binding === 'show-downloads') {
        void this.openOverlay('downloads');
        return true;
      }
      if (binding?.startsWith('workspace-')) {
        const workspace = this.workspaces[Number(binding.slice(10)) - 1];
        if (workspace) this.workspace({ type: 'select', id: workspace.id });
        return true;
      }
      const legacy: Record<string, [string, boolean]> = {
        'new-tab': ['t', false],
        'close-tab': ['w', false],
        'reopen-tab': ['t', true],
        'open-command': ['l', false],
        'next-tab': ['Tab', false],
        'previous-tab': ['Tab', true],
        'show-history': ['h', false],
        'show-bookmarks': ['b', true],
      };
      if (binding && legacy[binding]) {
        const [key, shift] = legacy[binding];
        input = {
          ...input,
          key,
          shift,
          control: true,
          meta: false,
          alt: false,
        };
      } else if (!binding) return false;
    }
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt)
      return false;
    const key = input.key.toLowerCase();
    if (key === 't') {
      if (input.shift) {
        if (this.overlay) this.closeOverlay();
        this.reopen();
        this.active.view.webContents.focus();
      } else void this.openOverlay('command', true);
    } else if (key === 'w' && !input.shift) {
      if (this.overlay) this.closeOverlay();
      this.close(this.activeId);
      this.active.view.webContents.focus();
    } else if (key === 'l' && !input.shift) void this.openOverlay('command');
    else if (key === 'h' && !input.shift) void this.openOverlay('history');
    else if (key === 'b' && input.shift) void this.openOverlay('bookmarks');
    else if (key === 'tab') {
      if (this.overlay) this.closeOverlay();
      const tabs = this.tabs.filter(
        (t) => !t.previewSourceId && t.state.workspaceId === this.workspaceId,
      );
      const index = tabs.findIndex(
        (tab) =>
          tab.state.id === (this.active.previewSourceId ?? this.activeId),
      );
      this.select(
        tabs[(index + (input.shift ? -1 : 1) + tabs.length) % tabs.length].state
          .id,
      );
      this.active.view.webContents.focus();
    } else return false;
    return true;
  }
  layout() {
    const [width, height] = this.win.getContentSize();
    const settings = this.environment.settings();
    const inset =
      this.compact || this.htmlFullscreen
        ? 0
        : settings.contentInset
          ? CONTENT_INSET
          : 0;
    const sidebar = this.htmlFullscreen
      ? 0
      : this.compact
        ? 6
        : this.sidebar.expanded
          ? this.sidebar.width
          : settings.collapsedWidth;
    // Inset leaves a gap on every side of the page, including next to the sidebar.
    const x = (settings.sidebarPosition === 'left' ? sidebar : 0) + inset;
    const available = Math.max(0, width - sidebar - inset * 2);
    const split = this.htmlFullscreen ? null : this.split;
    const first = split ? Math.floor((available - 8) * split.ratio) : available;
    const findHeight = this.environment.findActive() ? 48 : 0;
    const top = this.slidingTop ?? this.topbar().topInset;
    for (const tab of this.tabs) {
      if (tab.state.unloaded) continue;
      tab.view.setBackgroundColor(
        tab.state.url === NEW_TAB_URL || tab.state.url === SETTINGS_URL
          ? '#00000000'
          : '#ffffff',
      );
      const second = split?.ids[1] === tab.state.id;
      const splitToolbar = second && !split?.preview ? SPLIT_TOOLBAR_HEIGHT : 0;
      if (tab.previewSourceId) this.updatePreviewControl(tab);
      tab.view.setBounds({
        x: x + (second ? first + 8 : 0),
        y: top + inset + findHeight + splitToolbar,
        width: second ? available - first - 8 : first,
        height: Math.max(
          0,
          height - top - inset * 2 - findHeight - splitToolbar,
        ),
      });
      tab.view.setBorderRadius(
        !this.compact && !this.htmlFullscreen && settings.contentInset
          ? settings.radius
          : 0,
      );
      tab.view.setVisible(
        !this.overlay &&
          tab.state.url !== SETTINGS_URL &&
          !this.compactPreview &&
          (split
            ? split.ids.includes(tab.state.id)
            : tab.state.id === this.activeId),
      );
    }
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.sleepTimer);
    clearInterval(this.cursorTimer);
    clearInterval(this.slideTimer);
    clearTimeout(this.previewClosing?.timer);
    for (const tab of this.tabs)
      if (tab.view.webContents && !tab.view.webContents.isDestroyed())
        tab.view.webContents.close();
    this.tabs = [];
  }
}
