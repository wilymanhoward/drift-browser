import { app, dialog, BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';
import type { UpdateStatus } from '../shared/browser';

// Checks every six hours; the first check waits for startup to settle.
const FIRST_CHECK = 30 * 1000;
const INTERVAL = 6 * 60 * 60 * 1000;

// Only the installed Windows build can replace itself. Development runs and
// the portable .exe have no installer to hand the update to.
export function canAutoUpdate(
  packaged = app.isPackaged,
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return packaged && platform === 'win32' && !env.PORTABLE_EXECUTABLE_DIR;
}

let updater: AppUpdater | null = null;
let status: Omit<UpdateStatus, 'current'> = { state: 'unsupported' };
const set = (next: typeof status) => {
  status = next;
};

const check = async () => {
  // A download in progress or waiting to install is not restarted.
  if (!updater || ['checking', 'downloading', 'ready'].includes(status.state))
    return;
  set({ state: 'checking' });
  try {
    await updater.checkForUpdates();
    // No result event means the updater skipped the check.
    if (status.state === 'checking') set({ state: 'idle' });
  } catch (error) {
    console.error('Update check failed:', error);
    set({ state: 'error' });
  }
};

// Settings shows this status and its button runs the matching command.
export async function updateCommand(command: unknown): Promise<UpdateStatus> {
  if (command === 'check') await check();
  else if (command === 'install') {
    if (updater && status.state === 'ready') updater.quitAndInstall();
  } else if (command !== 'status') throw new Error('Invalid update command.');
  return { ...status, current: app.getVersion() };
}

// Downloads new releases from the GitHub feed in electron-builder.json in the
// background and installs them on the next quit, or right away if the user
// chooses to restart. Builds are unsigned, so app-update.yml carries no
// publisherName and the installer's signature is not checked; the download is
// still verified against the sha512 in latest.yml.
export async function startAutoUpdates() {
  if (!canAutoUpdate()) return;
  let loaded: AppUpdater;
  try {
    ({ autoUpdater: loaded } = await import('electron-updater'));
  } catch (error) {
    console.error('Updater unavailable:', error);
    return;
  }
  updater = loaded;
  set({ state: 'idle' });
  loaded.autoDownload = true;
  loaded.autoInstallOnAppQuit = true;
  // Never move an installed copy to a pre-release or an older version.
  loaded.allowPrerelease = false;
  loaded.allowDowngrade = false;
  loaded.logger = null;
  let asked = false;
  loaded.on('error', (error) => {
    console.error('Update failed:', error);
    if (status.state !== 'ready') set({ state: 'error' });
  });
  loaded.on('update-not-available', () => set({ state: 'latest' }));
  loaded.on('update-available', (info) =>
    set({ state: 'downloading', version: info.version, percent: 0 }),
  );
  loaded.on('download-progress', (progress) =>
    set({
      state: 'downloading',
      version: status.version,
      percent: Math.round(progress.percent),
    }),
  );
  loaded.on('update-downloaded', (info) => {
    set({ state: 'ready', version: info.version });
    if (asked) return;
    asked = true;
    const win =
      BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const options = {
      type: 'info' as const,
      title: 'Drift update',
      message: `Drift ${info.version} is ready.`,
      detail:
        'Restart now to finish updating, or keep browsing and it installs the next time Drift closes.',
      buttons: ['Later', 'Restart now'],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
    };
    void (
      win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
    )
      .then(({ response }) => {
        if (response === 1) loaded.quitAndInstall();
      })
      .catch(() => undefined);
  });
  setTimeout(() => void check(), FIRST_CHECK).unref();
  setInterval(() => void check(), INTERVAL).unref();
}
