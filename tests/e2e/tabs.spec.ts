import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromeWindow } from './helpers';

async function launch(profile: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
}
const state = async (chrome: Page) => {
  await chrome.waitForFunction(
    () => typeof window.drift?.getState === 'function',
  );
  return chrome.evaluate(() => window.drift.getState());
};
async function shortcut(
  app: ElectronApplication,
  key: string,
  shift = false,
  web = false,
) {
  await app.evaluate(
    ({ BrowserWindow }, { key, shift, web }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.focus();
      const target = web
        ? (
            win.contentView.children.find((view) =>
              view.getVisible(),
            ) as Electron.WebContentsView
          ).webContents
        : win.webContents;
      target.focus();
      target.sendInputEvent({
        type: 'keyDown',
        keyCode: key,
        modifiers: ['control', ...(shift ? ['shift' as const] : [])],
      });
      if (!target.isDestroyed())
        target.sendInputEvent({
          type: 'keyUp',
          keyCode: key,
          modifiers: ['control', ...(shift ? ['shift' as const] : [])],
        });
    },
    { key, shift, web },
  );
}
async function browse(chrome: Page, url: string, title: string) {
  await chrome.evaluate(() => window.drift.action('open-command'));
  await chrome.getByLabel('Web address', { exact: true }).fill(url);
  await chrome.getByLabel('Web address', { exact: true }).press('Enter');
  await expect(chrome.getByRole('tab', { selected: true })).toHaveText(title);
  await expect(chrome.getByRole('status')).toHaveText('Ready');
}
test('tabs retain state, reorder, close/reopen, and survive restart and crash', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/favicon.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#466a55"/></svg>',
      );
      return;
    }
    const title =
      req.url === '/two'
        ? 'Second tab'
        : req.url === '/three'
          ? 'Third tab'
          : 'First tab';
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<html><head><title>${title}</title><link rel="icon" href="/favicon.svg"></head><body><h1>${title}</h1><input id="retained" aria-label="Retained value"><a href="/three" target="_blank">Open third</a></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const profile = test.info().outputPath('profile');
  let app: ElectronApplication | undefined;
  try {
    app = await launch(profile);
    let chrome = await chromeWindow(app);
    const pageErrors: string[] = [];
    chrome.on('pageerror', (error) => pageErrors.push(error.message));
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '48px');
    await chrome.getByRole('complementary').hover();
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '224px');
    await chrome.mouse.move(600, 400);
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '48px');
    await chrome.getByLabel('Pin sidebar open', { exact: true }).click();
    await browse(chrome, `${origin}/one`, 'First tab');
    const first = (await state(chrome)).activeTabId;
    await expect
      .poll(async () => (await state(chrome)).tabs[0].favicon)
      .toBe(`${origin}/favicon.svg`);
    await app.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0].contentView
        .children[0] as Electron.WebContentsView;
      return view.webContents.executeJavaScript(
        "document.getElementById('retained').value='keep me'",
      );
    });
    await app.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0].contentView
        .children[0] as Electron.WebContentsView;
      return view.webContents.executeJavaScript(
        "document.querySelector('a').click()",
        true,
      );
    });
    await expect(chrome.getByRole('tab')).toHaveCount(2);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Third tab',
    );
    await shortcut(app, 'w');
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    await chrome.getByLabel('New tab', { exact: true }).click();
    await expect(
      chrome.getByLabel('Web address', { exact: true }),
    ).toBeFocused();
    await browse(chrome, `${origin}/two`, 'Second tab');
    const second = (await state(chrome)).activeTabId;
    await chrome.getByRole('tab', { name: 'First tab', exact: true }).click();
    expect(
      await app.evaluate(({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0].contentView
          .children[0] as Electron.WebContentsView;
        return view.webContents.executeJavaScript(
          "document.getElementById('retained').value",
        );
      }),
    ).toBe('keep me');
    const views = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].contentView.children.map((view) =>
        view.getVisible(),
      ),
    );
    expect(views).toEqual([true, false]);
    await shortcut(app, 'Tab', false, true);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Second tab',
    );
    await shortcut(app, 'Tab', true, true);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'First tab',
    );
    await shortcut(app, 't');
    await browse(chrome, `${origin}/three`, 'Third tab');
    const third = (await state(chrome)).activeTabId;
    await chrome
      .getByRole('tab', { name: 'Third tab', exact: true })
      .dragTo(chrome.getByRole('tab', { name: 'First tab', exact: true }));
    await expect
      .poll(async () => (await state(chrome)).tabs.map((tab) => tab.id))
      .toEqual([third, first, second]);
    await chrome
      .getByRole('tab', { name: 'Third tab', exact: true })
      .press('Alt+ArrowDown');
    await expect
      .poll(async () => (await state(chrome)).tabs.map((tab) => tab.id))
      .toEqual([first, third, second]);
    await shortcut(app, 'w');
    await expect(chrome.getByRole('tab')).toHaveCount(2);
    await chrome.getByLabel('Reopen closed tab', { exact: true }).click();
    await expect(chrome.getByRole('tab')).toHaveCount(3);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Third tab',
    );
    await expect(chrome.getByRole('status')).toHaveText('Ready');
    await browse(chrome, `${origin}/two`, 'Second tab');
    await shortcut(app, 'w');
    await shortcut(app, 't', true);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Second tab',
    );
    await expect(chrome.getByRole('status')).toHaveText('Ready');
    await chrome.getByLabel('Back', { exact: true }).click();
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Third tab',
    );
    await chrome
      .getByRole('tab', { name: 'First tab', exact: true })
      .click({ button: 'middle' });
    await expect(chrome.getByRole('tab')).toHaveCount(2);
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'mute', id }),
      second,
    );
    await expect(
      chrome.getByLabel('Unmute Second tab', { exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Unmute Second tab', { exact: true }).click();
    await expect
      .poll(
        async () =>
          (await state(chrome)).tabs.find((tab) => tab.id === second)?.muted,
      )
      .toBe(false);
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'duplicate', id }),
      second,
    );
    await expect(chrome.getByRole('tab')).toHaveCount(3);
    await shortcut(app, 'w');
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'select', id }),
      third,
    );
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'mute', id }),
      second,
    );
    await chrome.getByRole('separator', { name: 'Sidebar width' }).focus();
    await chrome
      .getByRole('separator', { name: 'Sidebar width' })
      .press('ArrowRight');
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '232px');
    const handle = await chrome
      .getByRole('separator', { name: 'Sidebar width' })
      .boundingBox();
    if (!handle) throw new Error('Missing resize handle');
    await chrome.mouse.move(handle.x + 2, handle.y + 50);
    await chrome.mouse.down();
    await chrome.mouse.move(280, handle.y + 50);
    await chrome.mouse.up();
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '280px');
    const rejected = await chrome.evaluate(async () => {
      const results = await Promise.allSettled([
        window.drift.tab({ type: 'select', id: 'missing' }),
        window.drift.tab({ type: 'move', id: 'missing', index: -1 }),
        window.drift.sidebar({ width: 900 }),
      ]);
      return results.every((result) => result.status === 'rejected');
    });
    expect(rejected).toBe(true);
    const snapshot = await state(chrome);
    await expect
      .poll(async () =>
        JSON.parse(
          await readFile(path.join(profile, 'session.json'), 'utf8'),
        ).session.tabs.map((tab: { id: string }) => tab.id),
      )
      .toEqual(snapshot.tabs.map((tab) => tab.id));
    expect(pageErrors).toEqual([]);
    await app.close();
    app = await launch(profile);
    chrome = await chromeWindow(app);
    await expect
      .poll(async () => (await state(chrome)).tabs.map((tab) => tab.id))
      .toEqual(snapshot.tabs.map((tab) => tab.id));
    expect((await state(chrome)).activeTabId).toBe(snapshot.activeTabId);
    expect(
      (await state(chrome)).tabs.find((tab) => tab.id === second)?.muted,
    ).toBe(true);
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '280px');
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Third tab',
    );
    // Kill the test-owned process after autosave, then restore the same profile.
    const process = app.process();
    const exited = new Promise<void>((resolve) =>
      process.once('exit', () => resolve()),
    );
    process.kill();
    await exited;
    await app.close().catch(() => {});
    app = await launch(profile);
    chrome = await chromeWindow(app);
    await expect
      .poll(async () => (await state(chrome)).tabs.map((tab) => tab.id))
      .toEqual(snapshot.tabs.map((tab) => tab.id));
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'close-others', id }),
      snapshot.activeTabId,
    );
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    await shortcut(app, 'w');
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    expect((await state(chrome)).activeTabId).not.toBe(snapshot.activeTabId);
  } finally {
    await app?.close().catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('corrupt session is preserved and reported without blocking launch', async () => {
  const profile = test.info().outputPath('corrupt-profile');
  await mkdir(profile, { recursive: true });
  const file = path.join(profile, 'session.json');
  const original = '{broken json';
  await writeFile(file, original);
  const app = await launch(profile);
  try {
    const chrome = await chromeWindow(app);
    await chrome.getByLabel('Pin sidebar open', { exact: true }).click();
    await expect(chrome.getByRole('alert')).toContainText(
      'Session storage is unavailable',
    );
  } finally {
    await app.close();
  }
  expect(await readFile(file, 'utf8')).toBe(original);
});
