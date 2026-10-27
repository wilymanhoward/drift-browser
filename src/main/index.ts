import {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
} from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACTIONS, CONTENT_INSET, SIDEBAR_WIDTH } from '../shared/browser';
import type { BrowserAction, BrowserState } from '../shared/browser';
import { isWebURL, navigationURL } from './navigation';

app.setName('Drift');
app.enableSandbox();
let window: BrowserWindow | null = null;

async function createWindow() {
  const devURL = !app.isPackaged ? process.env.DRIFT_DEV_URL : undefined;
  if (devURL && devURL !== 'http://127.0.0.1:5173')
    throw new Error('Invalid development origin.');
  const uiURL =
    devURL ??
    pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
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
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      partition: 'persist:drift',
      navigateOnDragDrop: false,
    },
  });
  win.contentView.addChildView(view);
  const page = view.webContents;
  let error: string | null = null;
  const state = (): BrowserState => ({
    url: page.getURL(),
    title: page.getTitle(),
    loading: page.isLoading(),
    canGoBack: page.navigationHistory.canGoBack(),
    canGoForward: page.navigationHistory.canGoForward(),
    maximized: win.isMaximized(),
    error,
  });
  const publish = () => {
    if (!win.isDestroyed() && !page.isDestroyed())
      win.webContents.send('drift:state', state());
  };
  const layout = () => {
    const [width, height] = win.getContentSize();
    view.setBounds({
      x: SIDEBAR_WIDTH,
      y: CONTENT_INSET,
      width: Math.max(0, width - SIDEBAR_WIDTH - CONTENT_INSET),
      height: Math.max(0, height - CONTENT_INSET * 2),
    });
  };
  const navigate = async (input: unknown) => {
    const url = navigationURL(input);
    error = null;
    try {
      await page.loadURL(url);
    } catch (cause) {
      if (!(cause instanceof Error && cause.message.includes('ERR_ABORTED'))) {
        error =
          'This page could not be loaded. Check the address and your connection.';
      }
    }
    publish();
  };
  const authorize = (event: IpcMainInvokeEvent) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      (event.senderFrame.url !== uiURL && event.senderFrame.url !== `${uiURL}/`)
    ) {
      throw new Error('Unauthorized IPC sender.');
    }
  };
  ipcMain.handle('drift:state', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Invalid arguments.');
    return state();
  });
  ipcMain.handle('drift:navigate', async (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Invalid arguments.');
    await navigate(args[0]);
  });
  ipcMain.handle('drift:action', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1 || !ACTIONS.includes(args[0] as BrowserAction))
      throw new Error('Invalid action.');
    switch (args[0] as BrowserAction) {
      case 'back':
        if (page.navigationHistory.canGoBack()) page.navigationHistory.goBack();
        break;
      case 'forward':
        if (page.navigationHistory.canGoForward())
          page.navigationHistory.goForward();
        break;
      case 'reload':
        error = null;
        page.reload();
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
    }
  });
  page.on('did-start-loading', () => {
    error = null;
    publish();
  });
  page.on('did-stop-loading', publish);
  page.on('did-navigate', publish);
  page.on('did-navigate-in-page', publish);
  page.on('page-title-updated', publish);
  page.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) {
      error =
        'This page could not be loaded. Check the address and your connection.';
      publish();
    }
  });
  page.on('render-process-gone', () => {
    error = 'The page stopped responding. Reload to try again.';
    publish();
  });
  page.on('will-navigate', (event, url) => {
    if (!isWebURL(url)) event.preventDefault();
  });
  page.on('will-redirect', (event, url) => {
    if (!isWebURL(url)) event.preventDefault();
  });
  page.setWindowOpenHandler(({ url }) => {
    if (isWebURL(url)) void navigate(url);
    return { action: 'deny' };
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.on('resize', layout);
  win.on('maximize', publish);
  win.on('unmaximize', publish);
  win.on('closed', () => {
    for (const channel of ['drift:state', 'drift:navigate', 'drift:action'])
      ipcMain.removeHandler(channel);
    if (!page.isDestroyed()) page.close();
    window = null;
  });
  layout();
  await win.loadURL(uiURL);
  win.show();
  void navigate('https://example.com');
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
