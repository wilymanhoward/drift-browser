import { _electron as electron, expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';

test('a finished download can be dragged out as a file', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="notes.txt"',
    });
    res.end('hello');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notes.txt`;
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
  const target = test.info().outputPath('notes.txt');
  try {
    const chrome = await chromeWindow(app);
    // A real OS drag cannot run under test, so record what would be dragged.
    await app.evaluate(
      async ({ BrowserWindow, webContents }, { url, target }) => {
        const g = globalThis as unknown as { dragged: unknown[] };
        g.dragged = [];
        BrowserWindow.getAllWindows()[0].webContents.startDrag = (item) => {
          g.dragged.push({
            file: item.file,
            icon: typeof item.icon !== 'string' && !item.icon.isEmpty(),
          });
        };
        const tab = webContents
          .getAllWebContents()
          .find((page) => page.getURL().startsWith('drift://newtab'))!;
        // A download started while the page is still loading gets cancelled.
        if (tab.isLoading())
          await new Promise<void>((resolve) =>
            tab.once('did-stop-loading', () => resolve()),
          );
        tab.session.once('will-download', (_event, item) =>
          item.setSavePath(target),
        );
        tab.downloadURL(url);
      },
      { url, target },
    );
    await chrome.evaluate(() => window.drift.action('show-downloads'));
    const row = chrome.getByRole('region', { name: 'notes.txt' });
    await expect(row).toHaveAttribute('draggable', 'true');
    await row.dispatchEvent('dragstart');
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as unknown as { dragged: unknown[] }).dragged,
        ),
      )
      .toEqual([{ file: target, icon: true }]);
    // The panel closes so the file can be dropped onto the page.
    await expect(row).toHaveCount(0);
  } finally {
    await app.close();
    server.close();
  }
});
