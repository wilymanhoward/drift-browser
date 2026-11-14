import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';

// A 1x1 PNG, served as the site's icon.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
);

test('Essentials show the site icon, reach new windows and outlast a restart', async () => {
  test.setTimeout(90000);
  const server = createServer((req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(PNG);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<title>Home</title><p>home');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const profile = test.info().outputPath('profile');
  const launch = () =>
    electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  const chromes = (app: ElectronApplication) =>
    app.windows().filter((page) => page.url().includes('/renderer/index.html'));
  const essentials = (chrome: Page) => chrome.locator('.tab-row.essential');
  let app = await launch();
  try {
    const chrome = await chromeWindow(app);
    await chrome.evaluate(async () => {
      const state = await window.drift.getState();
      await window.drift.settings({ ...state.settings, startup: 'new-tab' });
    });
    await chrome.evaluate((url) => window.drift.navigate(url), `${origin}/`);
    await expect
      .poll(
        async () =>
          (await chrome.evaluate(() => window.drift.getState())).favicon,
      )
      .toMatch(/^data:image\//);
    await chrome.evaluate(async (url) => {
      const state = await window.drift.getState();
      await window.drift.tab({ type: 'pin', id: state.activeTabId });
      await window.drift.bookmark({
        type: 'save',
        url,
        title: 'Home',
        folder: 'Bookmarks',
      });
    }, `${origin}/`);
    await expect(essentials(chrome)).toHaveCount(1);

    // A new window shows the same Essential, asleep, with the site's icon.
    await chrome.evaluate(() => window.drift.action('new-window'));
    await expect.poll(() => chromes(app).length).toBe(2);
    const second = chromes(app).find((page) => page !== chrome)!;
    await expect(essentials(second)).toHaveCount(1);
    await expect(essentials(second).locator('img.favicon')).toHaveAttribute(
      'src',
      /^data:image\//,
    );
    await app.close();

    // After a restart that opens a new tab instead of the old session, the
    // Essential is still there, and the bookmark tile has the site's icon.
    app = await launch();
    const restarted = await chromeWindow(app);
    await expect(essentials(restarted)).toHaveCount(1);
    await expect
      .poll(() =>
        app.windows().some((page) => page.url() === 'drift://newtab/'),
      )
      .toBe(true);
    const newTab = app
      .windows()
      .find((page) => page.url() === 'drift://newtab/')!;
    await newTab.reload();
    await expect(newTab.locator('.tile .tile-icon img')).toHaveAttribute(
      'src',
      /^data:image\//,
    );

    // Unpinning removes it; with one window it stays open as an ordinary tab.
    await restarted.evaluate(async () => {
      const state = await window.drift.getState();
      const tab = state.tabs.find((t) => t.pinned)!;
      await window.drift.tab({ type: 'pin', id: tab.id });
    });
    await expect(essentials(restarted)).toHaveCount(0);
    await app.close();
    app = await launch();
    await expect(essentials(await chromeWindow(app))).toHaveCount(0);
  } finally {
    await app.close();
    server.close();
  }
});
