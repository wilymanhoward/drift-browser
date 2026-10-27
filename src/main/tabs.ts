import { BrowserWindow, Menu, WebContentsView } from 'electron';
import type { Input, NavigationEntry, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { DEFAULT_WORKSPACE } from '../shared/power';
import type { Workspace, WorkspaceCommand } from '../shared/power';
import { CONTENT_INSET } from '../shared/browser';
import type {
  BrowserState,
  TabCommand,
  TabState,
  SidebarUpdate,
} from '../shared/browser';
import { DEFAULT_SIDEBAR } from './session';
import type { SavedSession, SavedTab } from './session';
import {
  isPageURL,
  isWebURL,
  navigationURL,
  NEW_TAB_URL,
  SETTINGS_URL,
} from '../shared/navigation';

interface Tab {
  view: WebContentsView;
  state: TabState;
  navigationURL: string;
  lastActive: number;
  suspended?: ClosedTab;
}
interface ClosedTab {
  tab: SavedTab;
  index: number;
  history: NavigationEntry[];
  historyIndex: number;
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
  private sleepTimer: ReturnType<typeof setInterval>;
  constructor(
    private win: BrowserWindow,
    private changed: () => void,
    private visited: (url: string, title: string, increment: boolean) => void,
    private environment: {
      partition: string;
      privateWindow: boolean;
      track: (page: WebContents) => void;
      settings: () => import('../shared/settings').Settings;
    },
  ) {
    this.sleepTimer = setInterval(() => this.sleepInactive(), 30000);
    this.sleepTimer.unref();
  }
  restore(saved: SavedSession | null) {
    if (saved) {
      this.workspaces = saved.workspaces ?? [{ ...DEFAULT_WORKSPACE }];
      this.workspaceId = saved.activeWorkspaceId ?? this.workspaces[0].id;
      this.sidebar = { ...saved.sidebar, expanded: saved.sidebar.pinned };
      for (const tab of saved.tabs) this.create(tab.url, tab, false);
      this.select(saved.activeTabId);
    } else this.create();
  }
  get state(): Omit<BrowserState, 'storageError' | 'settings' | 'dark'> {
    return {
      ...this.active.state,
      tabs: this.tabs.map((tab) => ({ ...tab.state })),
      activeTabId: this.activeId,
      maximized: this.win.isMaximized(),
      canReopen: this.closed.length > 0,
      sidebar: { ...this.sidebar },
      overlay: this.overlay,
      privateWindow: this.environment.privateWindow,
      workspaces: this.workspaces.map((w) => ({ ...w })),
      activeWorkspaceId: this.workspaceId,
      compact: this.compact,
      compactPreview: this.compactPreview,
      split: this.split,
    };
  }
  get saved(): SavedSession {
    return {
      version: 1,
      tabs: this.tabs.map(({ state }) => ({
        id: state.id,
        url: state.url,
        title: state.title.slice(0, 1024),
        muted: state.muted,
        workspaceId: state.workspaceId,
        pinned: state.pinned,
      })),
      activeTabId: this.activeId,
      sidebar: { pinned: this.sidebar.pinned, width: this.sidebar.width },
      workspaces: this.workspaces,
      activeWorkspaceId: this.workspaceId,
    };
  }
  get active() {
    return this.tabs.find((tab) => tab.state.id === this.activeId)!;
  }
  owns(page: WebContents) {
    return this.tabs.some(
      (t) => !t.state.unloaded && t.view.webContents.id === page.id,
    );
  }
  private emit() {
    if (!this.disposed && this.tabs.length) this.changed();
  }
  create(
    url = NEW_TAB_URL,
    saved?: SavedTab,
    select = true,
    history?: ClosedTab,
  ): Tab {
    const target = navigationURL(url);
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: this.environment.partition,
        navigateOnDragDrop: false,
      },
    });
    const tab: Tab = {
      view,
      navigationURL: target,
      lastActive: Date.now(),
      state: {
        id: saved?.id ?? randomUUID(),
        url: target,
        title: saved?.title ?? (target === NEW_TAB_URL ? 'New tab' : ''),
        loading: true,
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
        unloaded: false,
      },
    };
    const page = view.webContents;
    this.environment.track(page);
    this.tabs.push(tab);
    this.win.contentView.addChildView(view);
    view.setVisible(false);
    page.setAudioMuted(tab.state.muted);
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
    page.on('did-start-navigation', (_event, url, _inPlace, mainFrame) => {
      if (mainFrame) {
        tab.navigationURL = url;
        if (isWebURL(url)) tab.state.url = url;
        tab.state.error = null;
        tab.state.favicon = null;
      }
    });
    page.on('did-start-loading', () => {
      tab.state.error = null;
      update();
    });
    page.on('did-stop-loading', update);
    page.on('did-finish-load', () => {
      if (tab.state.url === SETTINGS_URL && tab.state.id === this.activeId)
        void this.openOverlay('settings');
    });
    page.on('did-navigate', (_event, url) => {
      if (isPageURL(url)) tab.state.url = url;
      this.visited(url, page.getTitle(), true);
      update();
    });
    page.on('did-navigate-in-page', (_event, url, mainFrame) => {
      if (mainFrame && isPageURL(url)) {
        tab.state.url = url;
        this.visited(url, page.getTitle(), true);
      }
      update();
    });
    page.on('page-title-updated', () => {
      this.visited(tab.state.url, page.getTitle(), false);
      update();
    });
    page.on('audio-state-changed', update);
    page.on('page-favicon-updated', (_event, urls) => {
      tab.state.favicon = urls.find(isWebURL) ?? null;
      update();
    });
    page.on('did-fail-load', (_event, code, _description, url, mainFrame) => {
      if (mainFrame && code !== -3 && url === tab.navigationURL) {
        tab.state.error =
          'This page could not be loaded. Check the address and your connection.';
        update();
      }
    });
    page.on('render-process-gone', () => {
      tab.state.error = 'The page stopped responding. Reload to try again.';
      update();
    });
    page.on('will-navigate', (event, url) => {
      if (!isPageURL(url)) event.preventDefault();
    });
    page.on('will-redirect', (event, url) => {
      if (!isPageURL(url)) event.preventDefault();
    });
    page.setWindowOpenHandler(({ url }) => {
      if (isWebURL(url)) this.create(url);
      return { action: 'deny' };
    });
    page.on('before-input-event', (event, input) => {
      if (this.shortcut(input)) event.preventDefault();
    });
    page.on('focus', () => {
      if (
        this.split?.ids.includes(tab.state.id) &&
        this.activeId !== tab.state.id
      ) {
        this.activeId = tab.state.id;
        tab.lastActive = Date.now();
        this.emit();
      }
    });
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
  select(id: string) {
    if (!this.tabs.some((tab) => tab.state.id === id))
      throw new Error('Unknown tab.');
    const chosen = this.wake(id);
    if (this.workspaceId !== chosen.state.workspaceId) this.split = null;
    if (this.split && !this.split.ids.includes(id))
      this.split.ids[this.split.ids.indexOf(this.activeId)] = id;
    this.workspaceId = chosen.state.workspaceId;
    this.activeId = id;
    chosen.lastActive = Date.now();
    this.layout();
    this.emit();
  }
  close(id: string) {
    const index = this.tabs.findIndex((tab) => tab.state.id === id);
    if (index < 0) throw new Error('Unknown tab.');
    const tab = this.tabs[index];
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
    if (!tab.state.unloaded) {
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
        t.state.workspaceId === tab.state.workspaceId &&
        t.state.pinned === tab.state.pinned,
    );
    const peerIndex = peers.indexOf(tab);
    switch (command.type) {
      case 'select':
        this.select(command.id);
        if (tab.state.url === SETTINGS_URL) void this.openOverlay('settings');
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
  updateSidebar(update: SidebarUpdate) {
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
    const existing = this.tabs.find((tab) => tab.state.url === SETTINGS_URL);
    if (existing) this.select(existing.state.id);
    else this.create(SETTINGS_URL);
    return this.openOverlay('settings');
  }
  workspace(command: WorkspaceCommand) {
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
  toggleSplit(id?: string) {
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
    const cutoff =
      Date.now() - this.environment.settings().unloadMinutes * 60000;
    for (const tab of this.tabs) if (tab.lastActive < cutoff) this.sleep(tab);
  }
  private wake(id: string): Tab {
    const tab = this.tabs.find((t) => t.state.id === id)!;
    if (!tab.state.unloaded) return tab;
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    const replacement = this.create(
      tab.state.url,
      { ...tab.state },
      false,
      tab.suspended,
    );
    this.tabs.splice(this.tabs.indexOf(replacement), 1);
    this.tabs.splice(index, 0, replacement);
    return replacement;
  }
  shortcut(input: Input): boolean {
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
        (t) => t.state.workspaceId === this.workspaceId,
      );
      const index = tabs.indexOf(this.active);
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
    const inset = this.compact ? 0 : settings.contentInset ? CONTENT_INSET : 0;
    const sidebar = this.compact
      ? 6
      : this.sidebar.expanded
        ? this.sidebar.width
        : settings.collapsedWidth;
    const x = settings.sidebarPosition === 'left' ? sidebar : inset;
    const available = Math.max(0, width - sidebar - inset);
    const first = this.split
      ? Math.floor((available - 8) * this.split.ratio)
      : available;
    for (const tab of this.tabs) {
      if (tab.state.unloaded) continue;
      const second = this.split?.ids[1] === tab.state.id;
      tab.view.setBounds({
        x: x + (second ? first + 8 : 0),
        y: inset,
        width: second ? available - first - 8 : first,
        height: Math.max(0, height - inset * 2),
      });
      tab.view.setBorderRadius(
        !this.compact && settings.contentInset ? settings.radius : 0,
      );
      tab.view.setVisible(
        !this.overlay &&
          !this.compactPreview &&
          (this.split
            ? this.split.ids.includes(tab.state.id)
            : tab.state.id === this.activeId),
      );
    }
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.sleepTimer);
    for (const tab of this.tabs)
      if (!tab.state.unloaded && !tab.view.webContents.isDestroyed())
        tab.view.webContents.close();
    this.tabs = [];
  }
}
