import { app, dialog, BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';

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

// Downloads new releases from the GitHub feed in electron-builder.json in the
// background and installs them on the next quit, or right away if the user
// chooses to restart.
export async function startAutoUpdates() {
  if (!canAutoUpdate()) return;
  let updater: AppUpdater;
  try {
    ({ autoUpdater: updater } = await import('electron-updater'));
  } catch (error) {
    console.error('Updater unavailable:', error);
    return;
  }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  // Never move an installed copy to a pre-release or an older version.
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.logger = null;
  let asked = false;
  updater.on('error', (error) => console.error('Update failed:', error));
  updater.on('update-downloaded', (info) => {
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
        if (response === 1) updater.quitAndInstall();
      })
      .catch(() => undefined);
  });
  const check = () =>
    void updater
      .checkForUpdates()
      .catch((error) => console.error('Update check failed:', error));
  setTimeout(check, FIRST_CHECK).unref();
  setInterval(check, INTERVAL).unref();
}
