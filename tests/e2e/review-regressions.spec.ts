import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromeWindow } from './helpers';

async function launch() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({
    args: ['.', `--user-data-dir=${test.info().outputPath('profile')}`],
    env,
  });
}
async function otherChrome(app: ElectronApplication, previous: Page[]) {
  let page: Page | undefined;
  await expect
    .poll(() => {
      page = app
        .windows()
        .find(
          (page) =>
            !previous.includes(page) &&
            /\/renderer\/index\.html$/.test(page.url()),
        );
      return Boolean(page);
    })
    .toBe(true);
  await expect(page!.getByRole('complementary')).toBeVisible();
  return page!;
}
async function fixture() {
  const icon = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=',
    'base64',
  );
  const server = createServer((req, res) => {
    if (req.url?.endsWith('.png')) {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'max-age=86400',
      });
      res.end(icon);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<html><title>Review fixture</title><link rel="icon" href="/private-review-icon.png"><h1>Review fixture</h1></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  return { server, port: (server.address() as AddressInfo).port };
}

test('private favicon requests stay out of the persistent chrome cache', async () => {
  const { server, port } = await fixture();
  const app = await launch();
  try {
    const normal = await chromeWindow(app);
    await normal.evaluate(() => window.drift.action('private-window'));
    const privateChrome = await otherChrome(app, [normal]);
    await app.evaluate(({ BrowserWindow, session }) => {
      const requests = { regular: [] as string[], private: [] as string[] };
      (
        globalThis as unknown as { iconRequests: typeof requests }
      ).iconRequests = requests;
      session.defaultSession.webRequest.onCompleted(({ url }) =>
        requests.regular.push(url),
      );
      const privateSession = BrowserWindow.getAllWindows().find(
        (win) => win.webContents.session !== session.defaultSession,
      )!.webContents.session;
      if (privateSession.isPersistent())
        throw new Error('Private chrome uses persistent storage');
      privateSession.webRequest.onCompleted(({ url }) =>
        requests.private.push(url),
      );
    });
    await privateChrome.evaluate(
      (url) => window.drift.navigate(url),
      `http://127.0.0.1:${port}/private`,
    );
    await expect
      .poll(() =>
        app.evaluate(() =>
          (
            globalThis as unknown as { iconRequests: { private: string[] } }
          ).iconRequests.private.some((url) =>
            url.endsWith('/private-review-icon.png'),
          ),
        ),
      )
      .toBe(true);
    expect(
      await app.evaluate(() =>
        (
          globalThis as unknown as { iconRequests: { regular: string[] } }
        ).iconRequests.regular.filter((url) =>
          url.includes('private-review-icon'),
        ),
      ),
    ).toEqual([]);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  const cache = test.info().outputPath('profile', 'Cache', 'Cache_Data');
  const files = await readdir(cache).catch(() => [] as string[]);
  for (const file of files) {
    const bytes = await readFile(path.join(cache, file)).catch(() =>
      Buffer.alloc(0),
    );
    expect(bytes.includes(Buffer.from('private-review-icon'))).toBe(false);
  }
});

test('windows retain both zoom preferences and normal windows reopen beside a private window', async () => {
  const { server, port } = await fixture();
  const profile = test.info().outputPath('profile');
  let app = await launch();
  try {
    const first = await chromeWindow(app);
    await first.evaluate(() => window.drift.action('new-window'));
    const second = await otherChrome(app, [first]);
    const one = `http://127.0.0.1:${port}`;
    const two = `http://localhost:${port}`;
    await first.evaluate((url) => window.drift.navigate(url), one + '/one');
    await first.evaluate(() => window.drift.action('zoom-in'));
    await second.evaluate((url) => window.drift.navigate(url), two + '/two');
    await second.evaluate(() => window.drift.action('zoom-in'));
    expect(
      JSON.parse(await readFile(path.join(profile, 'zoom.json'), 'utf8')).zoom,
    ).toEqual({ [one]: 1.1, [two]: 1.1 });
    await second.evaluate((url) => window.drift.navigate(url), one + '/other');
    expect(
      (await second.evaluate(() => window.drift.getState())).zoomPercent,
    ).toBe(110);
    await first.evaluate(() => window.drift.action('private-window'));
    const privateChrome = await otherChrome(app, [first, second]);
    await app.evaluate(({ BrowserWindow, session }) => {
      for (const win of BrowserWindow.getAllWindows())
        if (win.webContents.session === session.defaultSession) win.close();
    });
    await expect
      .poll(() =>
        app.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
        ),
      )
      .toBe(1);
    await app.evaluate(({ app }, url) => {
      app.emit('second-instance', {}, ['Drift.exe', '--', url]);
    }, one + '/external');
    const reopened = await otherChrome(app, [privateChrome]);
    await expect
      .poll(() =>
        reopened.evaluate(() => window.drift.getState().then((s) => s.url)),
      )
      .toBe(one + '/external');
    await expect
      .poll(() =>
        reopened.evaluate(() =>
          window.drift.getState().then((state) => state.zoomPercent),
        ),
      )
      .toBe(110);
    await app.close();
    app = await launch();
    const restarted = await chromeWindow(app);
    await restarted.evaluate(
      (url) => window.drift.navigate(url),
      two + '/restart',
    );
    expect(
      (await restarted.evaluate(() => window.drift.getState())).zoomPercent,
    ).toBe(110);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Add site opens an editable bookmark and saves it across tabs and restart', async () => {
  let app = await launch();
  try {
    let chrome = await chromeWindow(app);
    let newTab: Page | undefined;
    await expect
      .poll(() => {
        newTab = app.windows().find((page) => page.url() === 'drift://newtab/');
        return Boolean(newTab);
      })
      .toBe(true);
    await newTab!
      .getByRole('link', { name: 'Add site', exact: true })
      .click({ noWaitAfter: true });
    await expect(chrome.getByLabel('Bookmark address')).toBeFocused();
    await chrome.getByLabel('Bookmark address').fill('https://example.com/');
    await chrome.getByLabel('Bookmark title').fill('Saved site');
    await chrome
      .getByRole('button', { name: 'Save bookmark', exact: true })
      .click();
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift
            .getLibrary()
            .then((s) => s.bookmarks.some((b) => b.title === 'Saved site')),
        ),
      )
      .toBe(true);
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await chrome.evaluate(() => window.drift.action('new-tab'));
    await chrome.getByLabel('Web address', { exact: true }).press('Escape');
    await expect
      .poll(() =>
        Promise.all(
          app
            .windows()
            .filter((page) => page.url() === 'drift://newtab/')
            .map((page) =>
              page
                .getByRole('link', { name: 'Saved site', exact: true })
                .count(),
            ),
        ).then((counts) => counts.filter(Boolean).length),
      )
      .toBe(2);
    await app.close();
    app = await launch();
    chrome = await chromeWindow(app);
    expect(
      (await chrome.evaluate(() => window.drift.getLibrary())).bookmarks.some(
        (b) => b.url === 'https://example.com/',
      ),
    ).toBe(true);
  } finally {
    await app.close();
  }
});

test('settings with a large accepted wallpaper can be exported and restored', async () => {
  const app = await launch();
  const wallpaper = test.info().outputPath('wallpaper.png');
  const backup = test.info().outputPath('settings-backup.json');
  try {
    const chrome = await chromeWindow(app);
    const png = await app.evaluate(({ nativeImage }) =>
      Array.from(
        nativeImage
          .createFromBitmap(Buffer.alloc(16, 255), { width: 2, height: 2 })
          .toPNG(),
      ),
    );
    await writeFile(
      wallpaper,
      Buffer.concat([Buffer.from(png), Buffer.alloc(2700000)]),
    );
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [paths.wallpaper],
        });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: paths.backup,
        });
      },
      { wallpaper, backup },
    );
    await chrome.evaluate(() => window.drift.settingsFile('wallpaper'));
    const before = (await chrome.evaluate(() => window.drift.getState()))
      .settings.wallpaper;
    expect(before.length).toBeGreaterThan(3 * 1024 * 1024);
    await chrome.evaluate(() => window.drift.settingsFile('export'));
    expect((await stat(backup)).size).toBeGreaterThan(3 * 1024 * 1024);
    await chrome.evaluate(async () =>
      window.drift.settings({
        ...(await window.drift.getState()).settings,
        wallpaper: '',
      }),
    );
    await app.evaluate(({ dialog }, backup) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [backup],
      });
    }, backup);
    await chrome.evaluate(() => window.drift.settingsFile('import'));
    expect(
      (await chrome.evaluate(() => window.drift.getState())).settings.wallpaper,
    ).toBe(before);
    await writeFile(backup, Buffer.alloc(6 * 1024 * 1024 + 1));
    await expect(
      chrome.evaluate(() => window.drift.settingsFile('import')),
    ).rejects.toThrow('The file is too large');
    expect(
      (await chrome.evaluate(() => window.drift.getState())).settings.wallpaper,
    ).toBe(before);
  } finally {
    await app.close();
  }
});
