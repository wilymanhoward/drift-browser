import { app, BrowserWindow, ipcMain, session, protocol } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
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

app.setName('Drift');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  { scheme: 'drift', privileges: { standard: true, secure: true } },
]);
let window: BrowserWindow | null = null;
async function createWindow() {
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
    const { default: ElectronStore } = await import('electron-store');
    store = new ElectronStore<{ session: unknown }>({ name: 'session' });
    const value = store.get('session');
    saved = parseSession(value);
    if (value !== undefined && !saved) {
      storageError =
        'The saved session could not be restored. The original file has been preserved.';
      store = null;
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
  window = win;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSaved = '';
  const library = new BrowserLibrary(() => publish());
  await library.load();
  const pageSession = session.fromPartition('persist:drift');
  if (pageSession.protocol.isProtocolHandled('drift'))
    pageSession.protocol.unhandle('drift');
  pageSession.protocol.handle('drift', (request) =>
    newTabResponse(request.url, library.data.bookmarks),
  );
  const state = (): BrowserState => ({
    ...tabs.state,
    storageError: storageError || library.error,
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
  );
  tabs.restore(saved);
  const authorize = (event: IpcMainInvokeEvent) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      (event.senderFrame.url !== uiURL && event.senderFrame.url !== `${uiURL}/`)
    )
      throw new Error('Unauthorized IPC sender.');
  };
  const handle = (
    channel: string,
    count: number,
    callback: (...args: unknown[]) => unknown,
  ) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      authorize(event);
      if (args.length !== count) throw new Error('Invalid arguments.');
      return callback(...args);
    });
  };
  handle('drift:state', 0, state);
  handle('drift:navigate', 1, (input) => {
    const url = resolveInput(input);
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
  handle('drift:tab', 1, (input) => tabs.command(parseTabCommand(input)));
  handle('drift:sidebar', 1, (input) =>
    tabs.updateSidebar(parseSidebar(input)),
  );
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
  win.on('close', () => {
    clearTimeout(timer);
    save();
    library.flush();
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
      ipcMain.removeHandler(channel);
    tabs.dispose();
    window = null;
  });
  await win.loadURL(uiURL);
  ready = true;
  publish();
  save();
  win.show();
}
void app
  .whenReady()
  .then(async () => {
    // Permission prompts arrive in phase 4; deny requests until that UI exists.
    for (const target of [
      session.defaultSession,
      session.fromPartition('persist:drift'),
    ]) {
      target.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      target.setPermissionCheckHandler(() => false);
    }
    await createWindow();
    app.on('activate', () => {
      if (!window) void createWindow();
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
