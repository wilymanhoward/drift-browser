import { _electron as electron, expect, test } from '@playwright/test';
import { chromeWindow } from './helpers';

test('typing right after opening a new tab goes into the address box', async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${test.info().outputPath('profile')}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].focus(),
    );
    await chrome.locator('button.new-tab').click();
    const address = chrome.getByRole('combobox', { name: 'Web address' });
    await expect(address).toBeFocused();
    // The new tab's own page loads after the overlay opens; focus must stay put.
    await chrome.waitForTimeout(800);
    await expect
      .poll(() =>
        app.evaluate(
          ({ BrowserWindow, webContents }) =>
            webContents.getFocusedWebContents()?.id ===
            BrowserWindow.getAllWindows()[0].webContents.id,
        ),
      )
      .toBe(true);
  } finally {
    await app.close();
  }
});
