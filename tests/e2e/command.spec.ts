import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromeWindow, openBrowserTool } from './helpers';
const state = (chrome: Page) => chrome.evaluate(() => window.drift.getState());
async function nativeShortcut(app: ElectronApplication, key: string) {
  await app.evaluate(({ BrowserWindow }, key) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.focus();
    const page = (
      win.contentView.children.find((view) =>
        view.getVisible(),
      ) as Electron.WebContentsView
    ).webContents;
    page.focus();
    page.sendInputEvent({
      type: 'keyDown',
      keyCode: key,
      modifiers: ['control'],
    });
    page.sendInputEvent({
      type: 'keyUp',
      keyCode: key,
      modifiers: ['control'],
    });
  }, key);
}
test('command bar, history, folders, and internal new-tab navigation persist', async () => {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<html><head><title>${req.url === '/one' ? 'Northwind guide' : 'Quiet harbor'}</title></head><body><h1>Navigation fixture</h1><input aria-label="Page note"></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const profile = test.info().outputPath('profile');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (item): item is [string, string] => item[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () =>
    electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  let app: ElectronApplication | undefined;
  try {
    app = await launch();
    let chrome = await chromeWindow(app);
    await expect
      .poll(async () => (await state(chrome)).url)
      .toBe('drift://newtab/');
    await expect
      .poll(() =>
        app!.windows().some((page) => page.url() === 'drift://newtab/'),
      )
      .toBe(true);
    let newTab = app
      .windows()
      .find((page) => page.url() === 'drift://newtab/')!;
    await expect(newTab.getByLabel('Current time')).toContainText(/\d/);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(640, 440),
    );
    expect(
      await newTab.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1320, 860),
    );
    await expect(newTab.getByLabel('Search or enter an address')).toBeVisible();
    expect(
      await newTab.evaluate(() => ({
        bridge: typeof (window as unknown as { drift?: unknown }).drift,
        node: typeof (globalThis as unknown as { process?: unknown }).process,
      })),
    ).toEqual({ bridge: 'undefined', node: 'undefined' });
    await newTab
      .getByLabel('Search or enter an address')
      .fill('javascript:alert(1)');
    await newTab.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(newTab.getByRole('alert')).toContainText('valid address');
    await newTab.getByLabel('Search or enter an address').fill(`${origin}/one`);
    await newTab.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Northwind guide',
    );
    const first = (await state(chrome)).activeTabId;
    await nativeShortcut(app, 't');
    await expect(
      chrome.getByRole('dialog', { name: 'New tab', exact: true }),
    ).toBeVisible();
    await expect(
      chrome.getByRole('combobox', { name: 'Web address' }),
    ).toBeFocused();
    await chrome
      .getByRole('combobox', { name: 'Web address' })
      .fill(`${origin}/two`);
    await chrome.getByRole('combobox', { name: 'Web address' }).press('Enter');
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Quiet harbor',
    );
    await chrome.getByLabel('Pin sidebar open', { exact: true }).click();
    await openBrowserTool(chrome, 'Bookmarks');
    await chrome
      .getByRole('button', { name: 'Bookmark this page', exact: true })
      .click();
    await chrome.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      (await chrome.evaluate(() => window.drift.getLibrary())).bookmarks,
    ).toHaveLength(0);
    await chrome
      .getByRole('button', { name: 'Bookmark this page', exact: true })
      .click();
    await chrome.getByLabel('Bookmark title').fill('Harbor reference');
    await chrome.getByLabel('Bookmark folder').fill('Research');
    await chrome
      .getByRole('button', { name: 'Save bookmark', exact: true })
      .click();
    await expect(
      chrome.getByRole('heading', { name: 'Research', exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Edit Harbor reference', { exact: true }).click();
    await chrome.getByLabel('Bookmark folder').fill('Reading');
    await chrome
      .getByRole('button', { name: 'Save bookmark', exact: true })
      .click();
    await expect(
      chrome.getByRole('heading', { name: 'Reading', exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Edit Harbor reference', { exact: true }).click();
    await chrome.getByLabel('Bookmark address').fill(`${origin}/two?moved=1`);
    await chrome
      .getByRole('button', { name: 'Save bookmark', exact: true })
      .click();
    await expect
      .poll(async () =>
        (await chrome.evaluate(() => window.drift.getLibrary())).bookmarks.map(
          (item) => item.url,
        ),
      )
      .toEqual([`${origin}/two?moved=1`]);
    await chrome.getByLabel('Edit Harbor reference', { exact: true }).click();
    await chrome.getByLabel('Bookmark address').fill(`${origin}/two`);
    await chrome
      .getByRole('button', { name: 'Save bookmark', exact: true })
      .click();
    await chrome.screenshot({ path: 'test-results/phase3-bookmarks.png' });
    await chrome.getByLabel('Search bookmarks').fill('hrbr');
    await expect(
      chrome.getByRole('button', { name: /Harbor reference http/ }),
    ).toHaveCount(1);
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await nativeShortcut(app, 'l');
    await expect(
      chrome.getByRole('combobox', { name: 'Web address' }),
    ).toBeFocused();
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children.every(
          (view) => !view.getVisible(),
        ),
      ),
    ).toBe(true);
    await chrome.getByRole('combobox', { name: 'Web address' }).fill('nrthwnd');
    await expect(
      chrome.getByRole('option', { name: /Northwind guide.*tab$/ }),
    ).toBeVisible();
    await chrome.screenshot({ path: 'test-results/phase3-command.png' });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(640, 440),
    );
    expect(
      await chrome.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      chrome.getByRole('combobox', { name: 'Web address' }),
    ).toBeVisible();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1320, 860),
    );
    await chrome
      .getByRole('combobox', { name: 'Web address' })
      .press('ArrowDown');
    await chrome.getByRole('combobox', { name: 'Web address' }).press('Enter');
    await expect
      .poll(async () => (await state(chrome)).activeTabId)
      .toBe(first);
    await nativeShortcut(app, 'l');
    await app.evaluate(({ BrowserWindow }) => {
      const page = BrowserWindow.getAllWindows()[0].webContents;
      page.sendInputEvent({
        type: 'keyDown',
        keyCode: 'Tab',
        modifiers: ['control'],
      });
      page.sendInputEvent({
        type: 'keyUp',
        keyCode: 'Tab',
        modifiers: ['control'],
      });
    });
    await expect(chrome.getByRole('dialog')).toHaveCount(0);
    expect((await state(chrome)).overlay).toBeNull();
    await nativeShortcut(app, 'l');
    await chrome
      .getByRole('combobox', { name: 'Web address' })
      .fill('Show browsing history');
    await chrome
      .getByRole('combobox', { name: 'Web address' })
      .press('ArrowDown');
    await chrome.getByRole('combobox', { name: 'Web address' }).press('Enter');
    await expect(
      chrome.getByRole('dialog', { name: 'History', exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Search history').fill('Quiet harbor');
    await expect(
      chrome.getByRole('button', { name: /Quiet harbor http/ }),
    ).toBeVisible();
    await chrome.getByRole('button', { name: /Quiet harbor http/ }).click();
    await expect(chrome.getByRole('dialog')).toHaveCount(0);
    await chrome.getByRole('button', { name: 'New tab', exact: true }).click();
    await chrome.getByRole('combobox', { name: 'Web address' }).press('Escape');
    await expect
      .poll(() =>
        app!.windows().some((page) => page.url() === 'drift://newtab/'),
      )
      .toBe(true);
    newTab = app.windows().find((page) => page.url() === 'drift://newtab/')!;
    await expect(
      newTab.getByRole('link', { name: 'Harbor reference', exact: true }),
    ).toBeVisible();
    await newTab.screenshot({ path: 'test-results/phase3-newtab.png' });
    await newTab
      .getByRole('link', { name: 'Harbor reference', exact: true })
      .click();
    await expect
      .poll(async () => (await state(chrome)).url)
      .toBe(`${origin}/two`);
    await app.context().route('https://www.google.com/search?**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><head><title>Search fixture</title></head><body>Search response</body></html>',
      }),
    );
    await chrome.evaluate(() => window.drift.action('open-command'));
    await chrome
      .getByRole('combobox', { name: 'Web address' })
      .fill('quiet browser');
    await chrome.getByLabel('Navigate or search', { exact: true }).click();
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Search fixture',
    );
    expect((await state(chrome)).url).toBe(
      'https://www.google.com/search?q=quiet%20browser',
    );
    await chrome.evaluate((url) => window.drift.navigate(url), `${origin}/two`);
    const rejected = await chrome.evaluate(async () => {
      const checks = await Promise.allSettled([
        window.drift.bookmark({
          type: 'save',
          url: 'javascript:alert(1)',
          title: 'Bad',
          folder: 'Bad',
        }),
        window.drift.bookmark({ type: 'remove', id: 'missing' }),
      ]);
      return checks.every((result) => result.status === 'rejected');
    });
    expect(rejected).toBe(true);
    await app.close();
    app = await launch();
    chrome = await chromeWindow(app);
    const saved = await chrome.evaluate(() => window.drift.getLibrary());
    expect(saved.bookmarks).toMatchObject([
      { title: 'Harbor reference', folder: 'Reading', url: `${origin}/two` },
    ]);
    expect(saved.history.map((item) => item.url)).toContain(`${origin}/one`);
    expect(saved.history.some((item) => item.url.startsWith('drift:'))).toBe(
      false,
    );
    await openBrowserTool(chrome, 'Bookmarks');
    await chrome.getByLabel('Remove Harbor reference', { exact: true }).click();
    await expect(
      chrome.getByText('Save a page to begin your bookmarks.'),
    ).toBeVisible();
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await openBrowserTool(chrome, 'History');
    await chrome
      .getByRole('button', { name: 'Clear history', exact: true })
      .click();
    await expect(
      chrome.getByText('Pages you visit will appear here.'),
    ).toBeVisible();
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await app.close();
    app = undefined;
    const disk = JSON.parse(
      await readFile(path.join(profile, 'library.json'), 'utf8'),
    );
    expect(disk.library.history).toEqual([]);
    expect(disk.library.bookmarks).toEqual([]);
  } finally {
    await app?.close().catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('a corrupt library is reported and preserved', async () => {
  const profile = test.info().outputPath('corrupt-library');
  await mkdir(profile, { recursive: true });
  const file = path.join(profile, 'library.json');
  const original = '{broken library';
  await writeFile(file, original);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (item): item is [string, string] => item[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await chrome.getByLabel('Pin sidebar open', { exact: true }).click();
    await expect(chrome.getByRole('alert')).toContainText(
      'History and bookmark storage is unavailable',
    );
  } finally {
    await app.close();
  }
  expect(await readFile(file, 'utf8')).toBe(original);
});
