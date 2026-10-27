import { BrowserWindow, Menu, WebContentsView } from 'electron';
import type { Input, NavigationEntry, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
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
  ) {}
  restore(saved: SavedSession | null) {
    if (saved) {
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
      })),
      activeTabId: this.activeId,
      sidebar: { pinned: this.sidebar.pinned, width: this.sidebar.width },
    };
  }
  get active() {
    return this.tabs.find((tab) => tab.state.id === this.activeId)!;
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
    this.activeId = id;
    for (const tab of this.tabs)
      tab.view.setVisible(tab.state.id === id && !this.overlay);
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
      },
      index,
      history: page.navigationHistory.getAllEntries(),
      historyIndex: page.navigationHistory.getActiveIndex(),
    });
    this.closed = this.closed.slice(-25);
    this.tabs.splice(index, 1);
    this.win.contentView.removeChildView(tab.view);
    page.close();
    if (!this.tabs.length) this.create();
    else if (this.activeId === id)
      this.select(this.tabs[Math.min(index, this.tabs.length - 1)].state.id);
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
        this.create(tab.state.url);
        break;
      case 'mute':
        tab.state.muted = !tab.state.muted;
        tab.view.webContents.setAudioMuted(tab.state.muted);
        this.emit();
        break;
      case 'close-others':
        for (const other of [...this.tabs])
          if (other !== tab) this.close(other.state.id);
        break;
      case 'menu':
        Menu.buildFromTemplate([
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
            enabled: this.tabs.indexOf(tab) > 0,
            click: () => this.move(command.id, this.tabs.indexOf(tab) - 1),
          },
          {
            label: 'Move down',
            enabled: this.tabs.indexOf(tab) < this.tabs.length - 1,
            click: () => this.move(command.id, this.tabs.indexOf(tab) + 1),
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
    for (const tab of this.tabs) tab.view.setVisible(false);
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
      if (tab.state.url === NEW_TAB_URL) tab.view.webContents.reload();
  }
  openSettings() {
    const existing = this.tabs.find((tab) => tab.state.url === SETTINGS_URL);
    if (existing) this.select(existing.state.id);
    else this.create(SETTINGS_URL);
    return this.openOverlay('settings');
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
      const index = this.tabs.indexOf(this.active);
      this.select(
        this.tabs[
          (index + (input.shift ? -1 : 1) + this.tabs.length) % this.tabs.length
        ].state.id,
      );
      this.active.view.webContents.focus();
    } else return false;
    return true;
  }
  layout() {
    const [width, height] = this.win.getContentSize();
    const settings = this.environment.settings();
    const inset = settings.contentInset ? CONTENT_INSET : 0;
    const sidebar = this.sidebar.expanded
      ? this.sidebar.width
      : settings.collapsedWidth;
    for (const tab of this.tabs)
      tab.view.setBounds({
        x: settings.sidebarPosition === 'left' ? sidebar : inset,
        y: inset,
        width: Math.max(0, width - sidebar - inset),
        height: Math.max(0, height - inset * 2),
      });
    for (const tab of this.tabs)
      tab.view.setBorderRadius(settings.contentInset ? settings.radius : 0);
  }
  dispose() {
    this.disposed = true;
    for (const tab of this.tabs)
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    this.tabs = [];
  }
}
