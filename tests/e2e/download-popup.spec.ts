import { _electron as electron, expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';

test('a finished download pops up, and its file drags out from there', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="report.txt"',
    });
    res.end('hello');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/report.txt`;
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
  const target = test.info().outputPath('report.txt');
  // The popup is its own page; this reads it from the main process.
  const popup = (script: string) =>
    app.evaluate(async ({ webContents }, script) => {
      const page = webContents
        .getAllWebContents()
        .find(
          (p) => p.getURL().startsWith('data:text/html') && !p.isDestroyed(),
        );
      return page ? page.executeJavaScript(script) : null;
    }, script);
  try {
    await chromeWindow(app);
    await app.evaluate(
      async ({ webContents }, { url, target }) => {
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
    await expect
      .poll(() => popup(`document.getElementById('name')?.textContent`))
      .toBe('report.txt');
    expect(
      await popup(`document.querySelector('.head span').textContent`),
    ).toBe('Download complete');
    // A real OS drag cannot run under test, so record what would be dragged.
    await app.evaluate(({ webContents }) => {
      const g = globalThis as unknown as { dragged: string[] };
      g.dragged = [];
      const page = webContents
        .getAllWebContents()
        .find((p) => p.getURL().startsWith('data:text/html'))!;
      page.startDrag = (item) => {
        g.dragged.push(item.file);
      };
    });
    await popup(
      `document.getElementById('file').dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }))`,
    );
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as unknown as { dragged: string[] }).dragged,
        ),
      )
      .toEqual([target]);
  } finally {
    await app.close();
    server.close();
  }
});
