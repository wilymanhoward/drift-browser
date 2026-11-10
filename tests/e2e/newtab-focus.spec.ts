import { test, expect, _electron as electron } from '@playwright/test';
import { chromeWindow } from './helpers';

test('a new tab leaves keyboard focus on the address popup', async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (item): item is [string, string] => item[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${test.info().outputPath('profile')}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await chrome.evaluate(() => window.drift.action('new-tab'));
    await expect(
      chrome.getByRole('combobox', { name: 'Web address' }),
    ).toBeFocused();
    // The new page grabs native focus as it loads; the chrome must win it back.
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.isFocused(),
        ),
      )
      .toBe(true);
    await chrome.waitForTimeout(1000);
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.isFocused(),
      ),
    ).toBe(true);
  } finally {
    await app.close();
  }
});
