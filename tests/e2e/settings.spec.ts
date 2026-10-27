import { test, expect, _electron as electron } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { chromeWindow } from './helpers';
test('settings apply live, export/import, and survive restart', async () => {
  const profile = test.info().outputPath('profile');
  const file = test.info().outputPath('settings-export.json');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (x): x is [string, string] => x[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () =>
    electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  let app = await launch();
  try {
    let chrome = await chromeWindow(app);
    await chrome.evaluate(() => window.drift.action('show-settings'));
    await expect(
      chrome.getByRole('dialog', { name: 'Settings', exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Theme', { exact: true }).selectOption('dark');
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--text')
            .trim(),
        ),
      )
      .toBe('#edf1eb');
    await chrome
      .getByLabel('Sidebar position', { exact: true })
      .selectOption('right');
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((x) => x.settings.sidebarPosition),
        ),
      )
      .toBe('right');
    await chrome
      .getByLabel('Search engine', { exact: true })
      .selectOption('brave');
    const before = await chrome.evaluate(() => window.drift.getState());
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, file);
    await chrome
      .getByRole('button', { name: 'Export settings', exact: true })
      .click();
    await expect
      .poll(async () => {
        try {
          return JSON.parse(await readFile(file, 'utf8')).searchEngine;
        } catch {
          return '';
        }
      })
      .toBe('brave');
    const imported = {
      ...before.settings,
      theme: 'light',
      sidebarPosition: 'left',
      searchEngine: 'google',
      customCSS: '.wordmark { letter-spacing: 2px !important; }',
    };
    await writeFile(file, JSON.stringify(imported));
    await chrome
      .getByRole('button', { name: 'Import settings', exact: true })
      .click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((x) => x.settings.theme),
        ),
      )
      .toBe('light');
    await expect(chrome.locator('.wordmark')).toHaveCSS(
      'letter-spacing',
      '2px',
    );
    await chrome
      .getByLabel('Shortcut open-command', { exact: true })
      .fill('Ctrl+K');
    await chrome
      .getByLabel('Shortcut open-command', { exact: true })
      .press('Tab');
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift
            .getState()
            .then((x) => x.settings.shortcuts['open-command']),
        ),
      )
      .toBe('Ctrl+K');
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => {
      const p = BrowserWindow.getAllWindows()[0].webContents;
      p.sendInputEvent({
        type: 'keyDown',
        keyCode: 'k',
        modifiers: ['control'],
      });
      p.sendInputEvent({ type: 'keyUp', keyCode: 'k', modifiers: ['control'] });
    });
    await expect(
      chrome.getByRole('combobox', { name: 'Web address' }),
    ).toBeFocused();
    await chrome.getByRole('combobox', { name: 'Web address' }).press('Escape');
    await app.close();
    app = await launch();
    chrome = await chromeWindow(app);
    expect(
      (await chrome.evaluate(() => window.drift.getState())).settings.shortcuts[
        'open-command'
      ],
    ).toBe('Ctrl+K');
    await chrome.screenshot({ path: 'test-results/phase5-settings.png' });
  } finally {
    await app.close();
  }
});
