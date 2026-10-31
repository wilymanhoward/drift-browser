import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';
import AxeBuilder from '@axe-core/playwright';
test('find, per-site zoom, print dispatch, menus, fullscreen, and accessible chrome', async () => {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<html lang="en"><title>Tools fixture</title><body><h1>Needle needle needle</h1><a id="link" href="/two">A link</a><input aria-label="Editable"><button onclick="document.documentElement.requestFullscreen()">Fullscreen content</button></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (x): x is [string, string] => x[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const profile = test.info().outputPath('profile');
  const launch = () =>
    electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  let app = await launch();
  try {
    let chrome = await chromeWindow(app);
    await chrome.evaluate((url) => window.drift.navigate(url), origin + '/one');
    await app.evaluate(({ BrowserWindow }) => {
      const p = BrowserWindow.getAllWindows()[0].webContents;
      p.sendInputEvent({
        type: 'keyDown',
        keyCode: 'f',
        modifiers: ['control'],
      });
      p.sendInputEvent({ type: 'keyUp', keyCode: 'f', modifiers: ['control'] });
    });
    await expect(chrome.getByLabel('Find text', { exact: true })).toBeFocused();
    await chrome.getByLabel('Find text', { exact: true }).fill('needle');
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.find?.matches),
        ),
      )
      .toBe(3);
    await chrome
      .getByRole('button', { name: 'Next match', exact: true })
      .click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.find?.active),
        ),
      )
      .toBe(2);
    await chrome
      .getByRole('button', { name: 'Previous match', exact: true })
      .click();
    await chrome.getByLabel('Find text', { exact: true }).fill('missing');
    await expect(chrome.locator('.find-bar [role=status]')).toHaveText(
      '0 of 0',
    );
    await chrome.getByLabel('Find text', { exact: true }).press('Escape');
    await expect(
      chrome.getByRole('form', { name: 'Find in page' }),
    ).toHaveCount(0);
    await chrome.evaluate(() => window.drift.action('zoom-in'));
    expect(
      (await chrome.evaluate(() => window.drift.getState())).zoomPercent,
    ).toBe(110);
    await chrome.getByRole('button', { name: 'Settings', exact: true }).click();
    await chrome.getByText('Browser tools', { exact: true }).click();
    await chrome.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.zoomPercent),
        ),
      )
      .toBe(120);
    await expect(
      chrome.getByRole('main', { name: 'Settings', exact: true }),
    ).toBeVisible();
    await chrome.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.zoomPercent),
        ),
      )
      .toBe(110);
    await chrome.evaluate((url) => window.drift.navigate(url), origin + '/two');
    expect(
      (await chrome.evaluate(() => window.drift.getState())).zoomPercent,
    ).toBe(110);
    await app.evaluate(({ webContents, Menu }) => {
      const p = webContents
        .getAllWebContents()
        .find((p) => p.getURL().endsWith('/two'))!;
      p.print = (options, callback) => {
        if (options?.silent !== false)
          throw new Error('Print must use a dialog');
        callback?.(true, '');
      };
      const build = Menu.buildFromTemplate;
      Menu.buildFromTemplate = (template) => {
        const menu = build(template);
        menu.popup = () => {};
        Menu.setApplicationMenu(menu);
        return menu;
      };
    });
    await chrome.evaluate(() => window.drift.action('print'));
    expect(
      await app.evaluate(async ({ webContents }) =>
        (
          await webContents
            .getAllWebContents()
            .find((p) => p.getURL().endsWith('/two'))!
            .printToPDF({})
        )
          .subarray(0, 5)
          .toString(),
      ),
    ).toBe('%PDF-');
    const web = app.windows().find((p) => p.url() === origin + '/two')!;
    await web.getByRole('button', { name: 'Fullscreen content' }).click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.htmlFullscreen),
        ),
      )
      .toBe(true);
    const fullBounds = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return w.contentView.children
        .filter((v) => v.getVisible())
        .map((v) => v.getBounds());
    });
    expect(fullBounds[0].x).toBe(0);
    await web.evaluate(() => document.exitFullscreen());
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.htmlFullscreen),
        ),
      )
      .toBe(false);
    await web.locator('#link').click({ button: 'right' });
    const labels = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()!.items.map((i) => i.label),
    );
    expect(labels).toContain('Open link in new tab');
    expect(labels).toContain('Copy link address');
    expect(labels).toContain('Inspect element');
    await app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()!;
      const item = menu.items.find((i) => i.label === 'Open link in new tab')!;
      item.click();
      Menu.setApplicationMenu(null);
    });
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.tabs.length),
        ),
      )
      .toBe(2);
    await chrome.evaluate(() => window.drift.action('fullscreen'));
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isFullScreen(),
        ),
      )
      .toBe(true);
    await chrome.evaluate(() => window.drift.action('fullscreen'));
    await chrome.evaluate(() => window.drift.sidebar({ pinned: true }));
    for (const theme of ['light', 'dark'] as const) {
      await chrome.evaluate(async (theme) => {
        const s = await window.drift.getState();
        await window.drift.settings({ ...s.settings, theme });
      }, theme);
      for (const action of [
        'show-settings',
        'show-workspaces',
        'show-downloads',
      ] as const) {
        await chrome.evaluate((action) => window.drift.action(action), action);
        await expect(
          chrome.getByRole(action === 'show-settings' ? 'main' : 'dialog'),
        ).toBeVisible();
        if (action === 'show-settings')
          await chrome.getByText('Browser tools', { exact: true }).click();
        const results = await new AxeBuilder({ page: chrome })
          .setLegacyMode()
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        ).toEqual([]);
        await chrome.getByLabel('Close dialog', { exact: true }).click();
      }
    }
    await chrome.screenshot({ path: 'test-results/phase7-chrome.png' });
    await chrome
      .locator('aside')
      .screenshot({ path: 'test-results/minimal-sidebar.png' });
    // Test a small supported window with both the native content and chrome present.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(640, 440),
    );
    expect(
      await chrome.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await app.close();
    app = await launch();
    chrome = await chromeWindow(app);
    expect(
      (await chrome.evaluate(() => window.drift.getState())).tabs.some(
        (t) => t.unloaded,
      ),
    ).toBe(true);
    await chrome.evaluate((url) => window.drift.navigate(url), origin + '/one');
    expect(
      (await chrome.evaluate(() => window.drift.getState())).zoomPercent,
    ).toBe(110);
    await chrome.evaluate(() => window.drift.action('zoom-reset'));
    expect(
      (await chrome.evaluate(() => window.drift.getState())).zoomPercent,
    ).toBe(100);
  } finally {
    await app.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
