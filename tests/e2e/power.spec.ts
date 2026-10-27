import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { chromeWindow } from './helpers';
test('workspaces, essentials, compact overlay, split panes, sleeping, and downloads', async () => {
  test.setTimeout(65000);
  const server = createServer((req, res) => {
    if (req.url === '/file' || req.url === '/slow') {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="drift-test.bin"',
        'Content-Length': req.url === '/slow' ? 1024 * 1024 * 10 : 5,
      });
      if (req.url === '/file') res.end('drift');
      else {
        let sent = 0;
        const timer = setInterval(() => {
          res.write(Buffer.alloc(65536));
          sent += 65536;
          if (sent >= 1024 * 1024 * 10) {
            clearInterval(timer);
            res.end();
          }
        }, 100);
        res.on('close', () => clearInterval(timer));
      }
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<html><title>${req.url === '/two' ? 'Second' : 'First'}</title><body style="font-family:Segoe UI;background:#f8f8f5;padding:60px"><h1>${req.url === '/two' ? 'Second' : 'First'} page</h1><input aria-label="Draft"><a href="/file">Download</a></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const profile = test.info().outputPath('profile');
  const file = test.info().outputPath('drift-test.bin');
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
    const state = () => chrome.evaluate(() => window.drift.getState());
    await chrome.evaluate((url) => window.drift.navigate(url), origin + '/one');
    const first = (await state()).activeTabId;
    await chrome.evaluate(() => window.drift.action('new-tab'));
    await chrome.evaluate((url) => window.drift.navigate(url), origin + '/two');
    const second = (await state()).activeTabId;
    await chrome.evaluate(() => window.drift.sidebar({ pinned: true }));
    await chrome.evaluate((id) => window.drift.tab({ type: 'pin', id }), first);
    await expect(chrome.locator('.essential')).toHaveCount(1);
    await chrome.evaluate(() => window.drift.action('split'));
    await expect(
      chrome.getByRole('separator', { name: 'Split view width' }),
    ).toBeVisible();
    const bounds = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]
          .contentView.children.filter((v) => v.getVisible())
          .map((v) => v.getBounds()),
      );
    expect(await bounds()).toHaveLength(2);
    await chrome
      .getByRole('separator', { name: 'Split view width' })
      .press('ArrowRight');
    expect((await state()).split?.ratio).toBeCloseTo(0.55);
    await chrome.screenshot({ path: 'test-results/phase6-split.png' });
    await chrome.evaluate(() => window.drift.action('split'));
    await chrome.evaluate(() => window.drift.action('compact'));
    expect((await bounds())[0].x).toBe(6);
    await chrome.mouse.move(2, 300);
    await expect
      .poll(async () => (await state()).compactPreview !== null)
      .toBe(true);
    expect(await bounds()).toHaveLength(0);
    await expect(
      chrome.getByRole('button', { name: 'Minimize window', exact: true }),
    ).toBeVisible();
    await chrome.mouse.move(800, 400);
    await expect.poll(async () => (await state()).compactPreview).toBeNull();
    expect(await bounds()).toHaveLength(1);
    await chrome.evaluate(() => window.drift.action('compact'));
    await chrome.evaluate(() => window.drift.action('show-workspaces'));
    await chrome.getByLabel('Workspace name', { exact: true }).fill('Work');
    await chrome.getByLabel('Workspace icon', { exact: true }).fill('W');
    await chrome
      .getByRole('button', { name: 'Create workspace', exact: true })
      .click();
    await expect.poll(async () => (await state()).workspaces.length).toBe(2);
    const work = (await state()).workspaces.find((w) => w.name === 'Work')!.id;
    await chrome.evaluate(
      (id) => window.drift.workspace({ type: 'select', id }),
      work,
    );
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    await chrome.evaluate(
      ({ id, tabId }) =>
        window.drift.workspace({ type: 'move-tab', id, tabId }),
      { id: work, tabId: second },
    );
    await expect(chrome.getByRole('tab')).toHaveCount(2);
    await app.evaluate(({ BrowserWindow }) => {
      const page = BrowserWindow.getAllWindows()[0].webContents;
      page.sendInputEvent({
        type: 'keyDown',
        keyCode: '1',
        modifiers: ['control', 'alt'],
      });
      page.sendInputEvent({
        type: 'keyUp',
        keyCode: '1',
        modifiers: ['control', 'alt'],
      });
    });
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    expect((await state()).activeTabId).toBe(first);
    // The timer uses the same guarded destruction path as the manual menu action.
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'sleep', id }),
      second,
    );
    await expect
      .poll(
        async () => (await state()).tabs.find((t) => t.id === second)?.unloaded,
      )
      .toBe(true);
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'select', id }),
      second,
    );
    await expect
      .poll(
        async () => (await state()).tabs.find((t) => t.id === second)?.unloaded,
      )
      .toBe(false);
    await expect.poll(async () => (await state()).title).toBe('Second');
    await chrome.evaluate(() => window.drift.action('show-workspaces'));
    await chrome
      .getByLabel('Workspace name', { exact: true })
      .fill('Temporary');
    await chrome
      .getByRole('button', { name: 'Create workspace', exact: true })
      .click();
    await chrome
      .getByRole('button', { name: 'Edit Temporary', exact: true })
      .click();
    await chrome.getByLabel('Workspace name', { exact: true }).fill('Renamed');
    await chrome
      .getByRole('button', { name: 'Save workspace', exact: true })
      .click();
    await chrome
      .getByRole('button', { name: 'Remove Renamed', exact: true })
      .click();
    await expect.poll(async () => (await state()).workspaces.length).toBe(2);
    await chrome.screenshot({ path: 'test-results/phase6-workspaces.png' });
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await app.evaluate(({ session }, file) => {
      session
        .fromPartition('persist:drift')
        .on('will-download', (_e, item) => item.setSavePath(file));
    }, file);
    await app.evaluate(({ webContents }, url) => {
      const p = webContents
        .getAllWebContents()
        .find((p) => p.getURL().endsWith('/two'));
      p!.downloadURL(url);
    }, origin + '/file');
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getDownloads().then((x) => x[0]?.status),
        ),
      )
      .toBe('completed');
    expect(await readFile(file, 'utf8')).toBe('drift');
    await chrome.evaluate(() => window.drift.action('show-downloads'));
    await expect(
      chrome.getByRole('button', { name: 'Show in folder' }),
    ).toBeVisible();
    await app.evaluate(({ shell }, expected) => {
      shell.showItemInFolder = (filePath) => {
        if (filePath !== expected) throw new Error('Wrong download path');
      };
    }, file);
    await chrome
      .getByRole('button', { name: 'Show in folder', exact: true })
      .click();
    await expect(chrome.getByRole('alert')).toHaveCount(0);
    await chrome.screenshot({ path: 'test-results/phase6-downloads.png' });
    await chrome.getByRole('button', { name: 'Remove from list' }).click();
    await expect(
      chrome.getByText('No downloads in this window.'),
    ).toBeVisible();
    await app.evaluate(({ webContents }, url) => {
      webContents
        .getAllWebContents()
        .find((p) => p.getURL().endsWith('/two'))!
        .downloadURL(url);
    }, origin + '/slow');
    await expect(
      chrome.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible();
    await chrome.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(
      chrome.getByRole('button', { name: 'Resume', exact: true }),
    ).toBeVisible();
    await chrome.getByRole('button', { name: 'Resume', exact: true }).click();
    await chrome
      .getByRole('button', { name: 'Cancel download', exact: true })
      .click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getDownloads().then((x) => x[0]?.status),
        ),
      )
      .toBe('cancelled');
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await app.close();
    app = await launch();
    chrome = await chromeWindow(app);
    const restored = await state();
    expect(restored.workspaces.map((w) => w.name)).toEqual([
      'Personal',
      'Work',
    ]);
    expect(restored.tabs.find((t) => t.id === first)?.pinned).toBe(true);
    expect(restored.tabs.find((t) => t.id === second)?.workspaceId).toBe(work);
    // Exercise the actual timeout without a test-only application IPC endpoint.
    await chrome.evaluate(async () => {
      const s = await window.drift.getState();
      await window.drift.settings({ ...s.settings, unloadMinutes: 1 });
    });
    await app.evaluate(() => {
      const now = Date.now;
      Date.now = () => now() + 61000;
    });
    await expect
      .poll(async () => (await state()).tabs.some((t) => t.unloaded), {
        timeout: 35000,
      })
      .toBe(true);
  } finally {
    await app.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
