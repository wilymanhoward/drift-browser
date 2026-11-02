import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  protocol,
  nativeTheme,
  screen,
} from 'electron';
import type { Point, Rectangle, WebContents } from 'electron';
import type Store from 'electron-store';
import path from 'node:path';
import { release } from 'node:os';
import { pathToFileURL } from 'node:url';
import { ACTIONS } from '../shared/browser';
import type { BrowserAction, BrowserState } from '../shared/browser';
import { TabManager } from './tabs';
import type { MovedTab } from './tabs';
import type { SavedSession } from './session';
import {
  parseSession,
  parseSidebar,
  parseTabCardAnchor,
  parseTabCommand,
} from './session';
import { TabCard } from './tab-card';
import { BrowserLibrary, parseBookmark } from './library';
import { newTabResponse } from './new-tab';
import { resolveInput } from '../shared/navigation';
import { PrivacyController, loadFilters, refreshFilters } from './privacy';
import { randomUUID } from 'node:crypto';
import { SettingsStore } from './settings';
import { DEFAULT_SETTINGS, searchTemplate, themeCSS } from '../shared/settings';
import { parseWorkspace, parseDownload } from '../shared/power';
import { Downloads } from './downloads';
import { PageTools } from './page-tools';
import { PAGE_ACTIONS, parseFind } from '../shared/page-tools';
import type { PageAction } from '../shared/page-tools';
import { Extensions } from './extensions';
import { parseExtensionCommand } from '../shared/extensions';
import { pairedSidebar } from './window-layout';
import {
  detectBrowserSources,
  publicImportSource,
  readBrowserImport,
} from './browser-import';
import { parseBrowserImport } from '../shared/browser-import';
import type { BrowserImportResult } from '../shared/browser-import';
import { defaultBrowser } from './default-browser';
import { externalLink } from '../shared/external-links';
import { enableGoogleSignIn } from './google-signin';

app.setName('Drift');
app.enableSandbox();
enableGoogleSignIn();
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.commandLine.appendSwitch('test-third-party-cookie-phaseout');
// Chromium keeps a pre-started renderer ready for the next navigation; Drift
// trades that small speedup for one fewer idle process.
app.commandLine.appendSwitch(
  'disable-features',
  [
    app.commandLine.getSwitchValue('disable-features'),
    'SpareRendererForSitePerProcess',
  ]
    .filter(Boolean)
    .join(','),
);
protocol.registerSchemesAsPrivileged([
  { scheme: 'drift', privileges: { standard: true, secure: true } },
]);
// Windows 11 22H2+ supports acrylic; macOS always has vibrancy. Elsewhere the
// chrome paints its own frosted backdrop.
const nativeGlass =
  process.platform === 'darwin' ||
  (process.platform === 'win32' && Number(release().split('.')[2]) >= 22621);
const routes = new Map<
  string,
  Map<
    number,
    { url: string; fn: (...args: unknown[]) => unknown; count: number }
  >
>();
// Windows of one profile share history, settings and shields, so a second
// window never overwrites or switches off what the first one set up.
interface Profile {
  partition: string;
  privateWindow: boolean;
  library: BrowserLibrary;
  settings: SettingsStore;
  privacy: PrivacyController;
  extensions: Extensions | null;
  windows: DriftWindow[];
  store: Store<{ session: unknown }> | null;
  storageError: string | null;
  restore: SavedSession | null;
  lastSaved: string;
}
interface DriftWindow {
  win: BrowserWindow;
  tabs: TabManager;
  profile: Profile;
  publish: () => void;
  applySettings: () => Promise<void>;
  updatePosition: () => void;
}
const windowHandles = new Set<DriftWindow>();
function updateWindowPositions() {
  for (const handle of windowHandles) handle.updatePosition();
}
const profiles = new Map<string, Promise<Profile>>();
function openProfile(privateWindow: boolean) {
  const partition = privateWindow
    ? `drift-private-${randomUUID()}`
    : 'persist:drift';
  let profile = profiles.get(partition);
  if (!profile) {
    profile = loadProfile(partition, privateWindow);
    profiles.set(partition, profile);
    profile.catch(() => profiles.delete(partition));
  }
  return profile;
}
async function loadProfile(partition: string, privateWindow: boolean) {
  let store: Store<{ session: unknown }> | null = null;
  let storageError: string | null = null;
  let saved = null;
  try {
    if (!privateWindow) {
      const { default: ElectronStore } = await import('electron-store');
      store = new ElectronStore<{ session: unknown }>({ name: 'session' });
      const value = store.get('session');
      saved = parseSession(value);
      if (value !== undefined && !saved) {
        storageError =
          'The saved session could not be restored. The original file has been preserved.';
        store = null;
      }
    }
  } catch (error) {
    console.error('Session storage unavailable:', error);
    storageError = 'Session storage is unavailable. Changes will not be saved.';
  }
  const windows: DriftWindow[] = [];
  const publishAll = () => {
    for (const handle of windows) handle.publish();
  };
  const windowFor = (page: WebContents) =>
    windows.find((handle) => handle.tabs.owns(page)) ?? windows[0];
  const library = new BrowserLibrary(publishAll);
  const settings = new SettingsStore();
  await settings.load(privateWindow);
  if (!privateWindow) await library.load();
  const pageSession = session.fromPartition(partition);
  const privacy = new PrivacyController(
    pageSession,
    (page) => windowFor(page).win,
    privateWindow,
    publishAll,
    (id) => {
      const handle = windows.find(
        (w) => w.tabs.active.view.webContents.id === id,
      );
      if (handle) void handle.tabs.openOverlay('shields');
    },
  );
  await privacy.load();
  // After shields, so the store and extensions load under the same rules.
  const focused = () =>
    windows.find((handle) => handle.win.isFocused()) ?? windows[0];
  const extensions = privateWindow
    ? null
    : new Extensions(
        pageSession,
        {
          open: (url, active, windowId) => {
            const handle =
              windows.find((w) => w.win.id === windowId) ?? focused();
            if (!handle) throw new Error('No window is open.');
            const tab = handle.tabs.create(url, undefined, active);
            if (active) handle.win.focus();
            return [tab.view.webContents, handle.win];
          },
          select: (page) => {
            const handle = windowFor(page);
            const id = handle?.tabs.idOf(page);
            if (id) handle.tabs.select(id);
          },
          close: (page) => {
            const handle = windowFor(page);
            const id = handle?.tabs.idOf(page);
            if (id) handle.tabs.close(id);
          },
          window: () => focused()?.win,
        },
        publishAll,
      );
  await extensions?.load();
  if (pageSession.protocol.isProtocolHandled('drift'))
    pageSession.protocol.unhandle('drift');
  pageSession.protocol.handle('drift', (request) =>
    newTabResponse(
      request.url,
      library.data.bookmarks,
      settings.value,
      settings.dark,
      nativeGlass,
    ),
  );
  return {
    partition,
    privateWindow,
    library,
    settings,
    privacy,
    extensions,
    windows,
    store,
    storageError,
    restore: saved,
    lastSaved: '',
  } satisfies Profile;
}
const inside = (bounds: Rectangle, point: Point) =>
  point.x >= bounds.x &&
  point.x < bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y < bounds.y + bounds.height;
// A tab dropped outside its window moves, page and all, into the Drift window
// under the cursor, or into a new window opened there.
async function tearOff(source: DriftWindow, id: string) {
  const point = screen.getCursorScreenPoint();
  if (inside(source.win.getBounds(), point)) return;
  const target = source.profile.windows.find(
    (handle) =>
      handle !== source &&
      handle.win.isVisible() &&
      !handle.win.isMinimized() &&
      inside(handle.win.getBounds(), point),
  );
  const { width, height } = source.win.getNormalBounds();
  const area = screen.getDisplayNearestPoint(point).workArea;
  const bounds = {
    width,
    height,
    x: Math.max(area.x, Math.min(point.x - 120, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(point.y - 16, area.y + area.height - height)),
  };
  const only = source.tabs.state.tabs.length === 1;
  // The only tab carries its window with it, as in other browsers.
  if (only && !target) {
    if (source.win.isMaximized()) source.win.unmaximize();
    source.win.setBounds(bounds);
    return;
  }
  const moved = source.tabs.detach(id);
  if (only && target) {
    target.tabs.adopt(moved);
    target.win.focus();
    // Hand the saved session to the window that now holds the tab.
    const windows = source.profile.windows;
    windows.push(...windows.splice(windows.indexOf(source), 1));
    source.win.close();
    return;
  }
  if (target) {
    target.tabs.adopt(moved);
    target.win.focus();
    return;
  }
  try {
    await createWindow({ profile: source.profile, adopt: moved, bounds });
  } catch (error) {
    console.error('Could not open a window for the tab:', error);
    if (!source.win.isDestroyed()) source.tabs.adopt(moved);
    else moved.tab.view.webContents.close();
  }
}
async function createWindow(
  options: {
    privateWindow?: boolean;
    profile?: Profile;
    adopt?: MovedTab;
    bounds?: Rectangle;
  } = {},
) {
  const devURL = !app.isPackaged ? process.env.DRIFT_DEV_URL : undefined;
  if (devURL && devURL !== 'http://127.0.0.1:5173')
    throw new Error('Invalid development origin.');
  const uiURL =
    devURL ??
    pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
  const profile =
    options.profile ?? (await openProfile(options.privateWindow ?? false));
  const { library, settings, privacy, extensions, partition, privateWindow } =
    profile;
  // Only the first window of a run restores the saved session.
  const saved = options.adopt ? null : profile.restore;
  profile.restore = null;
  const win = new BrowserWindow({
    ...(options.bounds ?? { width: 1320, height: 860 }),
    minWidth: 640,
    minHeight: 440,
    frame: false,
    show: false,
    backgroundColor: nativeGlass ? '#00000000' : '#eef0f5',
    icon: path.join(__dirname, '../../assets/icon/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const chromeId = win.webContents.id;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pageSession = session.fromPartition(partition);
  let automaticSide: 'left' | 'right' | undefined;
  const windowSettings = () =>
    automaticSide
      ? { ...settings.value, sidebarPosition: automaticSide }
      : settings.value;
  const state = (): BrowserState => ({
    ...tabs.state,
    storageError:
      profile.storageError ||
      library.error ||
      settings.error ||
      pageTools.error,
    settings: settings.value,
    sidebarPosition: windowSettings().sidebarPosition,
    dark: settings.dark,
    find: pageTools.find,
    zoomPercent: Math.round(tabs.active.view.webContents.getZoomFactor() * 100),
    extensions: extensions?.state ?? null,
  });
  const publish = () => {
    // The hover card goes with dialogs and with the tab it describes.
    if (
      card.tabId &&
      (tabs.state.overlay ||
        tabs.state.htmlFullscreen ||
        !tabs.state.tabs.some((t) => t.id === card.tabId))
    )
      card.hide();
    if (ready && !win.isDestroyed())
      win.webContents.send('drift:state', state());
  };
  // The oldest open window owns the saved session, so the session that comes
  // back is the last window closed.
  const save = () => {
    if (!profile.store || profile.windows[0] !== current) return;
    const value = tabs.saved;
    const serialized = JSON.stringify(value);
    if (serialized === profile.lastSaved) return;
    try {
      profile.store.set('session', value);
      profile.lastSaved = serialized;
      if (profile.storageError) {
        profile.storageError = null;
        publish();
      }
    } catch (error) {
      console.error('Session save failed:', error);
      profile.storageError =
        'The session could not be saved. Check available disk space and file permissions.';
      publish();
    }
  };
  const pageTools: PageTools = new PageTools(
    win,
    () => tabs.active.view.webContents,
    (url) => tabs.create(url),
    () => {
      if (ready) {
        tabs.layout();
        publish();
      }
    },
  );
  await pageTools.load(privateWindow);
  if (extensions)
    pageTools.extraItems = (page, params) => extensions.menuItems(page, params);
  let extensionTab: WebContents | null = null;
  const tabs: TabManager = new TabManager(
    win,
    () => {
      // Extensions hear about tab switches from here, the one place every
      // selection passes through.
      const page = tabs.active.view.webContents;
      if (extensions && page !== extensionTab) {
        extensionTab = page;
        extensions.activate(page);
      }
      publish();
      if (ready) {
        clearTimeout(timer);
        timer = setTimeout(save, 250);
      }
    },
    (url, title, increment) => library.visit(url, title, increment),
    {
      partition,
      privateWindow,
      track: (page, adopted) => {
        // Shields are shared by the profile and already follow a moved page.
        if (!adopted) privacy.track(page);
        const detach = pageTools.attach(page);
        const untrack = extensions?.track(page, win);
        return () => {
          detach();
          untrack?.();
        };
      },
      settings: windowSettings,
      closeFind: () => pageTools.closeFind(),
      findActive: () => pageTools.find !== null,
      pageAction: (action) => runPageAction(action),
    },
  );
  const card = new TabCard(
    win,
    partition,
    () => ({
      css: themeCSS(settings.value, settings.dark, nativeGlass),
      dark: settings.dark,
    }),
    () => windowSettings().sidebarPosition,
  );
  if (options.adopt) tabs.adopt(options.adopt);
  else tabs.restore(settings.value.startup === 'restore' ? saved : null);
  function runPageAction(action: PageAction) {
    if (
      tabs.state.overlay &&
      !(
        ['settings', 'menu'].includes(tabs.state.overlay) &&
        action.startsWith('zoom-')
      )
    )
      tabs.closeOverlay();
    pageTools.action(action);
  }
  if (saved)
    settings.value.expandedWidth =
      saved.sidebar.width === 224
        ? DEFAULT_SETTINGS.expandedWidth
        : saved.sidebar.width;
  const downloads = new Downloads(
    pageSession,
    (page) => tabs.owns(page),
    publish,
  );
  let cssKey: string | null = null;
  const applySettings = async () => {
    const glass = nativeGlass && settings.value.glassEffect;
    if (process.platform === 'win32' && nativeGlass)
      win.setBackgroundMaterial(glass ? 'acrylic' : 'none');
    if (process.platform === 'darwin')
      win.setVibrancy(glass ? 'under-window' : null);
    win.setBackgroundColor(
      glass ? '#00000000' : settings.dark ? '#15161b' : '#eef0f5',
    );
    win.contentView.setBackgroundColor('#00000000');
    tabs.updateSidebar({
      width: settings.value.expandedWidth,
      ...(settings.value.lockCollapsed && { pinned: false, expanded: false }),
    });
    tabs.layout();
    const next = await win.webContents.insertCSS(
      themeCSS(settings.value, settings.dark, nativeGlass) +
        '\n' +
        settings.value.customCSS,
    );
    if (cssKey) await win.webContents.removeInsertedCSS(cssKey);
    cssKey = next;
    tabs.refreshNewTabs();
    publish();
  };
  const applyEverywhere = () =>
    Promise.all(profile.windows.map((handle) => handle.applySettings()));
  const updatePosition = () => {
    const visible = (window: BrowserWindow) =>
      !window.isDestroyed() && window.isVisible() && !window.isMinimized();
    const display = screen.getDisplayMatching(win.getBounds()).id;
    const peers = [...windowHandles]
      .filter(
        (handle) =>
          handle.win !== win &&
          visible(handle.win) &&
          screen.getDisplayMatching(handle.win.getBounds()).id === display,
      )
      .map((handle) => handle.win.getBounds());
    const next = visible(win)
      ? pairedSidebar(win.getBounds(), peers)
      : undefined;
    if (next === automaticSide) return;
    automaticSide = next;
    card.hide();
    tabs.layout();
    publish();
  };
  const current: DriftWindow = {
    win,
    tabs,
    profile,
    publish,
    applySettings,
    updatePosition,
  };
  profile.windows.push(current);
  windowHandles.add(current);
  const systemTheme = () => {
    void applySettings();
  };
  nativeTheme.on('updated', systemTheme);
  const handle = (
    channel: string,
    count: number,
    callback: (...args: unknown[]) => unknown,
  ) => {
    if (!routes.has(channel)) {
      routes.set(channel, new Map());
      ipcMain.handle(channel, (event, ...args: unknown[]) => {
        const entry = routes.get(channel)?.get(event.sender.id);
        if (
          !entry ||
          event.senderFrame !== event.sender.mainFrame ||
          (event.senderFrame.url !== entry.url &&
            event.senderFrame.url !== `${entry.url}/`)
        )
          throw new Error('Unauthorized IPC sender.');
        if (args.length !== entry.count) throw new Error('Invalid arguments.');
        return entry.fn(...args);
      });
    }
    routes.get(channel)!.set(chromeId, {
      url: uiURL,
      count,
      fn: (...args) => callback(...args),
    });
  };
  handle('drift:state', 0, state);
  handle('drift:default-browser', 1, defaultBrowser);
  handle('drift:find', 1, (input) => pageTools.findCommand(parseFind(input)));
  handle('drift:workspace', 1, (input) =>
    tabs.workspace(parseWorkspace(input)),
  );
  handle('drift:split-ratio', 1, (input) => tabs.setSplitRatio(input));
  handle('drift:downloads', 0, () => downloads.state);
  handle('drift:download', 1, (input) =>
    downloads.command(parseDownload(input)),
  );
  handle('drift:navigate', 1, (input) => {
    const url = resolveInput(input, searchTemplate(settings.value));
    tabs.closeOverlay();
    return tabs.navigate(url);
  });
  handle('drift:close-overlay', 0, () => tabs.closeOverlay());
  handle('drift:library', 0, () => library.data);
  handle('drift:bookmark', 1, (input) => {
    library.bookmark(parseBookmark(input));
    for (const other of profile.windows) other.tabs.refreshNewTabs();
  });
  handle('drift:clear-history', 0, () => library.clearHistory());
  handle('drift:extension', 1, async (input) => {
    if (!extensions) throw new Error('Extensions are off in private windows.');
    const command = parseExtensionCommand(input);
    // Opening a tab leaves the panel; removing asks over it.
    if (command.type === 'store' || command.type === 'options')
      tabs.closeOverlay();
    await extensions.command(command);
  });
  handle('drift:settings', 1, async (input) => {
    settings.set(input);
    await applyEverywhere();
  });
  const importRoots = {
    local:
      process.env.LOCALAPPDATA ??
      path.join(app.getPath('home'), 'AppData/Local'),
    roaming: process.env.APPDATA ?? app.getPath('appData'),
  };
  handle('drift:detect-browsers', 0, async () => {
    if (privateWindow) return [];
    return (await detectBrowserSources(importRoots)).map(publicImportSource);
  });
  handle('drift:import-browser', 1, async (input) => {
    if (privateWindow)
      throw new Error('Browser imports are available in regular windows.');
    const request = parseBrowserImport(input);
    const prepared = await readBrowserImport(importRoots, request);
    const result: BrowserImportResult = {
      bookmarksAdded: 0,
      bookmarksSkipped: 0,
      preferences: [],
      warnings: prepared.warnings,
      extensionsAdded: 0,
    };
    if (request.bookmarks && prepared.bookmarks.length)
      try {
        const merged = library.importBookmarks(prepared.bookmarks);
        result.bookmarksAdded = merged.added;
        result.bookmarksSkipped = merged.skipped;
        for (const handle of profile.windows) handle.tabs.refreshNewTabs();
      } catch {
        result.warnings.push(
          'Bookmarks could not be saved in Drift; existing bookmarks were kept.',
        );
      }
    if (request.preferences && Object.keys(prepared.preferences).length)
      try {
        if (settings.error) throw new Error('Settings storage unavailable.');
        settings.set({ ...settings.value, ...prepared.preferences });
        result.preferences = Object.keys(prepared.preferences).filter(
          (key) => key !== 'customSearch',
        );
        await applyEverywhere();
      } catch {
        result.warnings.push('Imported preferences could not be saved.');
      }
    for (const extension of prepared.extensions)
      try {
        if (!extensions) throw new Error('Extensions unavailable.');
        if (await extensions.importFromStore(extension.id, win, extension.name))
          result.extensionsAdded++;
        else
          result.warnings.push(
            `${extension.name}: already installed or installation cancelled.`,
          );
      } catch {
        result.warnings.push(
          `${extension.name}: could not be installed from the Chrome Web Store.`,
        );
      }
    return result;
  });
  handle('drift:settings-file', 1, async (mode) => {
    if (!['import', 'export', 'wallpaper'].includes(String(mode)))
      throw new Error('Invalid settings file action');
    await settings.transfer(win, mode as 'import' | 'export' | 'wallpaper');
    await applyEverywhere();
  });
  handle('drift:shields', 0, () =>
    privacy.state(tabs.active.view.webContents.id, tabs.active.state.url),
  );
  handle('drift:privacy', 1, async (input) => {
    if (
      input &&
      typeof input === 'object' &&
      (input as { type?: unknown }).type === 'update-filters'
    ) {
      if (Object.keys(input).some((key) => key !== 'type'))
        throw new Error('Invalid privacy command');
      await refreshFilters();
      for (const handle of windowHandles) handle.publish();
      tabs.active.view.webContents.reload();
      return;
    }
    const url = privacy.command(
      input,
      tabs.active.view.webContents.id,
      tabs.active.state.url,
    );
    if (url) {
      tabs.closeOverlay();
      return tabs.navigate(url);
    }
    if ((input as { type: string }).type === 'site')
      tabs.active.view.webContents.reload();
  });
  handle('drift:tab-card', 1, (input) => {
    const anchor = parseTabCardAnchor(input);
    if (!anchor || tabs.state.overlay || !win.isFocused()) card.hide();
    else void card.show(anchor, () => tabs.cardDetails(anchor.id));
  });
  handle('drift:tab', 1, (input) => {
    const command = parseTabCommand(input);
    card.hide();
    if (command.type === 'detach') return tearOff(current, command.id);
    tabs.command(command);
  });
  handle('drift:sidebar', 1, (input) => {
    const update = parseSidebar(input);
    if (update.width !== undefined)
      settings.set({ ...settings.value, expandedWidth: update.width });
    tabs.updateSidebar(update);
  });
  handle('drift:action', 1, (input) => {
    if (!ACTIONS.includes(input as BrowserAction))
      throw new Error('Invalid action.');
    if (PAGE_ACTIONS.includes(input as PageAction))
      return runPageAction(input as PageAction);
    switch (input as BrowserAction) {
      case 'back':
      case 'forward':
      case 'reload':
        tabs.navigation(input as 'back' | 'forward' | 'reload');
        break;
      case 'minimize':
        win.minimize();
        break;
      case 'maximize':
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
        break;
      case 'close':
        win.close();
        break;
      case 'new-tab':
        return tabs.openOverlay('command', true);
      case 'new-window':
        tabs.closeOverlay();
        return createWindow({ profile });
      case 'show-menu':
        if (tabs.state.overlay === 'menu') return tabs.closeOverlay();
        return tabs.openOverlay('menu');
      case 'open-command':
        return tabs.openOverlay('command');
      case 'show-history':
        return tabs.openOverlay('history');
      case 'show-bookmarks':
        return tabs.openOverlay('bookmarks');
      case 'show-shields':
        return tabs.openOverlay('shields');
      case 'private-window':
        return createWindow({ privateWindow: true });
      case 'show-settings':
        return tabs.openSettings();
      case 'show-workspaces':
        return tabs.openOverlay('workspaces');
      case 'show-downloads':
        return tabs.openOverlay('downloads');
      case 'show-extensions':
        return tabs.openOverlay('extensions');
      case 'compact':
        tabs.toggleCompact();
        break;
      case 'split':
        tabs.toggleSplit();
        break;
      case 'reopen-tab':
        tabs.reopen();
        break;
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('before-input-event', (event, input) => {
    if (tabs.shortcut(input)) event.preventDefault();
  });
  win.on('resize', () => {
    card.hide();
    updateWindowPositions();
    tabs.layout();
  });
  win.on('move', updateWindowPositions);
  win.on('show', updateWindowPositions);
  win.on('hide', updateWindowPositions);
  win.on('minimize', updateWindowPositions);
  win.on('restore', updateWindowPositions);
  win.on('maximize', updateWindowPositions);
  win.on('unmaximize', updateWindowPositions);
  win.on('blur', () => card.hide());
  win.on('maximize', publish);
  win.on('unmaximize', publish);
  let clearing = false;
  win.on('close', (event) => {
    clearTimeout(timer);
    save();
    // Shared profile data is flushed and cleared with the profile's last window.
    if (profile.windows.length > 1) return;
    library.flush();
    if ((privateWindow || privacy.configuration.clearOnExit) && !clearing) {
      event.preventDefault();
      clearing = true;
      library.clearHistory();
      library.flush();
      void privacy.clear().finally(() => win.close());
    }
  });
  win.on('closed', () => {
    ready = false;
    windowHandles.delete(current);
    updateWindowPositions();
    clearTimeout(timer);
    profile.windows.splice(profile.windows.indexOf(current), 1);
    for (const entries of routes.values()) entries.delete(chromeId);
    downloads.dispose();
    card.dispose();
    nativeTheme.removeListener('updated', systemTheme);
    tabs.dispose();
    if (!profile.windows.length) {
      privacy.dispose();
      profiles.delete(partition);
    }
  });
  await win.loadURL(uiURL);
  ready = true;
  await applySettings();
  publish();
  save();
  win.show();
}
let linksReady = false;
let openingLinks = false;
const firstLink = externalLink(process.argv);
const pendingLinks: string[] = firstLink ? [firstLink] : [];
async function openPendingLinks() {
  if (!linksReady || openingLinks) return;
  openingLinks = true;
  try {
    while (pendingLinks.length) {
      const url = pendingLinks.shift()!;
      let target =
        [...windowHandles].find(
          (handle) => !handle.profile.privateWindow && handle.win.isFocused(),
        ) ?? [...windowHandles].find((handle) => !handle.profile.privateWindow);
      if (!target) {
        await createWindow();
        target = [...windowHandles].find(
          (handle) => !handle.profile.privateWindow,
        )!;
      }
      if (target.tabs.state.overlay) target.tabs.closeOverlay();
      target.tabs.create(url);
      if (target.win.isMinimized()) target.win.restore();
      target.win.show();
      target.win.focus();
    }
  } finally {
    openingLinks = false;
  }
}
app.on('second-instance', (_event, argv) => {
  const url = externalLink(argv);
  if (url && pendingLinks.length < 32) pendingLinks.push(url);
  void openPendingLinks().catch(console.error);
  if (!url) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win?.isMinimized()) win.restore();
    win?.focus();
  }
});
if (primaryInstance)
  void app
    .whenReady()
    .then(async () => {
      await loadFilters();
      for (const target of [session.defaultSession]) {
        target.setPermissionRequestHandler((_contents, _permission, callback) =>
          callback(false),
        );
        target.setPermissionCheckHandler(() => false);
      }
      await createWindow();
      linksReady = true;
      await openPendingLinks();
      screen.on('display-metrics-changed', updateWindowPositions);
      screen.on('display-removed', updateWindowPositions);
      screen.on('display-added', updateWindowPositions);
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length) void createWindow();
      });
    })
    .catch((error) => {
      console.error(error);
      app.quit();
      process.exitCode = 1;
    });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
