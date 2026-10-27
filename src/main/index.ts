import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  protocol,
  nativeTheme,
} from 'electron';
import type Store from 'electron-store';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACTIONS } from '../shared/browser';
import type { BrowserAction, BrowserState } from '../shared/browser';
import { TabManager } from './tabs';
import { parseSession, parseSidebar, parseTabCommand } from './session';
import { BrowserLibrary, parseBookmark } from './library';
import { newTabResponse } from './new-tab';
import { resolveInput } from '../shared/navigation';
import { PrivacyController, loadFilters } from './privacy';
import { randomUUID } from 'node:crypto';
import { SettingsStore } from './settings';
import { searchTemplate, themeCSS } from '../shared/settings';
import { parseWorkspace, parseDownload } from '../shared/power';
import { Downloads } from './downloads';

app.setName('Drift');
app.enableSandbox();
app.commandLine.appendSwitch('test-third-party-cookie-phaseout');
protocol.registerSchemesAsPrivileged([
  { scheme: 'drift', privileges: { standard: true, secure: true } },
]);
const routes = new Map<
  string,
  Map<
    number,
    { url: string; fn: (...args: unknown[]) => unknown; count: number }
  >
>();
async function createWindow(privateWindow = false) {
  const devURL = !app.isPackaged ? process.env.DRIFT_DEV_URL : undefined;
  if (devURL && devURL !== 'http://127.0.0.1:5173')
    throw new Error('Invalid development origin.');
  const uiURL =
    devURL ??
    pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
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
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 640,
    minHeight: 440,
    frame: false,
    show: false,
    backgroundColor: '#eeede9',
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
  let lastSaved = '';
  const library = new BrowserLibrary(() => publish());
  const settings = new SettingsStore();
  await settings.load(privateWindow);
  if (!privateWindow) await library.load();
  const partition = privateWindow
    ? `drift-private-${randomUUID()}`
    : 'persist:drift';
  const pageSession = session.fromPartition(partition);
  const privacy = new PrivacyController(
    pageSession,
    win,
    privateWindow,
    () => publish(),
    (id) => {
      if (tabs.active.view.webContents.id === id)
        void tabs.openOverlay('shields');
    },
  );
  await privacy.load();
  if (pageSession.protocol.isProtocolHandled('drift'))
    pageSession.protocol.unhandle('drift');
  pageSession.protocol.handle('drift', (request) =>
    newTabResponse(
      request.url,
      library.data.bookmarks,
      settings.value,
      settings.dark,
    ),
  );
  const state = (): BrowserState => ({
    ...tabs.state,
    storageError: storageError || library.error || settings.error,
    settings: settings.value,
    dark: settings.dark,
  });
  const publish = () => {
    if (ready && !win.isDestroyed())
      win.webContents.send('drift:state', state());
  };
  const save = () => {
    if (!store) return;
    const value = tabs.saved;
    const serialized = JSON.stringify(value);
    if (serialized === lastSaved) return;
    try {
      store.set('session', value);
      lastSaved = serialized;
      if (storageError) {
        storageError = null;
        publish();
      }
    } catch (error) {
      console.error('Session save failed:', error);
      storageError =
        'The session could not be saved. Check available disk space and file permissions.';
      publish();
    }
  };
  const tabs = new TabManager(
    win,
    () => {
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
      track: (page) => privacy.track(page),
      settings: () => settings.value,
    },
  );
  tabs.restore(settings.value.startup === 'restore' ? saved : null);
  if (saved) settings.value.expandedWidth = saved.sidebar.width;
  const downloads = new Downloads(
    pageSession,
    (page) => tabs.owns(page),
    publish,
  );
  let cssKey: string | null = null;
  const applySettings = async () => {
    tabs.updateSidebar({ width: settings.value.expandedWidth });
    tabs.layout();
    const next = await win.webContents.insertCSS(
      themeCSS(settings.value, settings.dark) + '\n' + settings.value.customCSS,
    );
    if (cssKey) await win.webContents.removeInsertedCSS(cssKey);
    cssKey = next;
    tabs.refreshNewTabs();
    publish();
  };
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
    tabs.refreshNewTabs();
  });
  handle('drift:clear-history', 0, () => library.clearHistory());
  handle('drift:settings', 1, async (input) => {
    settings.set(input);
    await applySettings();
  });
  handle('drift:settings-file', 1, async (mode) => {
    if (!['import', 'export', 'wallpaper'].includes(String(mode)))
      throw new Error('Invalid settings file action');
    await settings.transfer(win, mode as 'import' | 'export' | 'wallpaper');
    await applySettings();
  });
  handle('drift:shields', 0, () =>
    privacy.state(tabs.active.view.webContents.id, tabs.active.state.url),
  );
  handle('drift:privacy', 1, (input) => {
    const url = privacy.command(
      input,
      tabs.active.view.webContents.id,
      tabs.active.state.url,
    );
    if (url) {
      tabs.closeOverlay();
      return tabs.navigate(url);
    }
  });
  handle('drift:tab', 1, (input) => tabs.command(parseTabCommand(input)));
  handle('drift:sidebar', 1, (input) => {
    const update = parseSidebar(input);
    if (update.width !== undefined)
      settings.set({ ...settings.value, expandedWidth: update.width });
    tabs.updateSidebar(update);
  });
  handle('drift:action', 1, (input) => {
    if (!ACTIONS.includes(input as BrowserAction))
      throw new Error('Invalid action.');
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
      case 'open-command':
        return tabs.openOverlay('command');
      case 'show-history':
        return tabs.openOverlay('history');
      case 'show-bookmarks':
        return tabs.openOverlay('bookmarks');
      case 'show-shields':
        return tabs.openOverlay('shields');
      case 'private-window':
        return createWindow(true);
      case 'show-settings':
        return tabs.openSettings();
      case 'show-workspaces':
        return tabs.openOverlay('workspaces');
      case 'show-downloads':
        return tabs.openOverlay('downloads');
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
  win.on('resize', () => tabs.layout());
  win.on('maximize', publish);
  win.on('unmaximize', publish);
  let clearing = false;
  win.on('close', (event) => {
    clearTimeout(timer);
    save();
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
    clearTimeout(timer);
    for (const channel of [
      'drift:state',
      'drift:navigate',
      'drift:action',
      'drift:tab',
      'drift:sidebar',
      'drift:close-overlay',
      'drift:library',
      'drift:bookmark',
      'drift:clear-history',
    ])
      routes.get(channel)?.delete(chromeId);
    for (const channel of ['drift:shields', 'drift:privacy'])
      routes.get(channel)?.delete(chromeId);
    privacy.dispose();
    downloads.dispose();
    for (const channel of [
      'drift:workspace',
      'drift:split-ratio',
      'drift:downloads',
      'drift:download',
    ])
      routes.get(channel)?.delete(chromeId);
    for (const channel of ['drift:settings', 'drift:settings-file'])
      routes.get(channel)?.delete(chromeId);
    nativeTheme.removeListener('updated', systemTheme);
    tabs.dispose();
  });
  await win.loadURL(uiURL);
  ready = true;
  await applySettings();
  publish();
  save();
  win.show();
}
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
