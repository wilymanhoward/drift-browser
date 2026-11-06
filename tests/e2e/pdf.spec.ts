import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { chromeWindow } from './helpers';

for (const privateWindow of [false, true]) {
  test(`PDF links render with browser controls (${privateWindow ? 'private' : 'regular'})`, async () => {
    let pdf: Buffer;
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/pdf');
      if (req.url === '/attachment.pdf')
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="attachment.pdf"',
        );
      res.end(pdf);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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
    try {
      let chrome = await chromeWindow(app);
      if (privateWindow) {
        await chrome.evaluate(() => window.drift.action('private-window'));
        await expect
          .poll(
            () =>
              app
                .windows()
                .filter((page) => /\/renderer\/index\.html$/.test(page.url()))
                .length,
          )
          .toBe(2);
        chrome = app
          .windows()
          .find(
            (page) =>
              page !== chrome && /\/renderer\/index\.html$/.test(page.url()),
          )!;
        await expect(chrome.getByRole('complementary')).toBeVisible();
      }
      pdf = Buffer.from(
        await app.evaluate(async ({ BrowserWindow }) => {
          const fixture = new BrowserWindow({
            show: false,
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false,
            },
          });
          try {
            await fixture.loadURL(
              'data:text/html,<title>Drift PDF fixture</title><h1>First PDF page</h1><h1 style="break-before:page">Second PDF page</h1>',
            );
            return Array.from(
              await fixture.webContents.printToPDF({ pageSize: 'A4' }),
            );
          } finally {
            fixture.destroy();
          }
        }),
      );
      const saved = test.info().outputPath('download.pdf');
      await app.evaluate(
        ({ webContents }, { privateWindow, saved }) => {
          webContents
            .getAllWebContents()
            .find(
              (page) =>
                page.getURL() === 'drift://newtab/' &&
                page.session.isPersistent() !== privateWindow,
            )!
            .session.on('will-download', (_event, item) =>
              item.setSavePath(saved),
            );
        },
        {
          privateWindow,
          saved,
        },
      );
      await chrome.evaluate(
        (url) => window.drift.navigate(url),
        origin + '/document.pdf',
      );
      await expect
        .poll(() =>
          app.windows().some((page) => page.url() === origin + '/document.pdf'),
        )
        .toBe(true);
      const document = app
        .windows()
        .find((page) => page.url() === origin + '/document.pdf')!;
      await expect
        .poll(() =>
          document
            .frames()
            .some((frame) =>
              frame
                .url()
                .startsWith(
                  'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/',
                ),
            ),
        )
        .toBe(true);
      const viewer = document
        .frames()
        .find((frame) =>
          frame
            .url()
            .startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'),
        )!;
      await expect(viewer.locator('pdf-viewer')).toBeVisible();
      await expect(
        viewer.getByRole('button', { name: 'Print', exact: true }),
      ).toBeVisible();
      await expect(
        viewer.getByRole('button', { name: 'Download', exact: true }),
      ).toBeVisible();
      const zoom = viewer.getByRole('textbox', {
        name: 'Zoom level',
        exact: true,
      });
      await expect(zoom).toHaveValue('100%');
      await viewer
        .getByRole('button', { name: 'Zoom in', exact: true })
        .click();
      await expect(zoom).not.toHaveValue('100%');
      await viewer
        .getByRole('button', { name: 'Zoom out', exact: true })
        .click();
      await expect(zoom).toHaveValue('100%');
      await viewer
        .getByRole('textbox', { name: 'Page number', exact: true })
        .fill('2');
      await viewer
        .getByRole('textbox', { name: 'Page number', exact: true })
        .press('Enter');
      await expect(
        viewer.getByRole('tab', {
          name: 'Thumbnail for page 2',
          selected: true,
        }),
      ).toBeVisible();
      expect(
        (await chrome.evaluate(() => window.drift.getState())).error,
      ).toBeNull();
      expect(
        await chrome.evaluate(() => window.drift.getDownloads()),
      ).toHaveLength(0);
      await document.screenshot({ path: test.info().outputPath('viewer.png') });
      await viewer
        .getByRole('button', { name: 'Download', exact: true })
        .click();
      await expect
        .poll(() =>
          chrome.evaluate(
            async () =>
              (await window.drift.getDownloads()).filter(
                (entry) => entry.done && entry.status === 'completed',
              ).length,
          ),
        )
        .toBe(1);
      expect(await readFile(saved)).toEqual(pdf);
      await chrome.evaluate(
        (url) => window.drift.navigate(url),
        origin + '/attachment.pdf',
      );
      await expect
        .poll(() =>
          chrome.evaluate(
            async () =>
              (await window.drift.getDownloads()).filter(
                (entry) => entry.done && entry.status === 'completed',
              ).length,
          ),
        )
        .toBe(2);
      expect(await readFile(saved)).toEqual(pdf);
    } finally {
      await app.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
