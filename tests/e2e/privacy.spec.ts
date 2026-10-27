import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';
test('Shields block trackers, strip parameters, and isolate private windows', async () => {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(req.headers.cookie || '');
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/cookie')
      res.setHeader('Set-Cookie', 'third=secret; SameSite=None; Secure');
    res.end(
      `<html><head><title>Privacy fixture</title></head><body><script src="https://td.doubleclick.net/ads.js"></script><iframe src="http://localhost:${(server.address() as AddressInfo).port}/cookie"></iframe></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (item): item is [string, string] => item[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${test.info().outputPath('profile')}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await app.context().route('https://td.doubleclick.net/**', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'window.adLoaded=true;',
      }),
    );
    await chrome.evaluate(
      (url) => window.drift.navigate(url),
      `${origin}/?utm_source=test&keep=1`,
    );
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((state) => state.url),
        ),
      )
      .toBe(`${origin}/?keep=1`);
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getShields().then((state) => state.blocked),
        ),
      )
      .toBeGreaterThan(0);
    await chrome.evaluate(() => window.drift.action('show-shields'));
    await expect(
      chrome.getByRole('dialog', { name: 'Shields', exact: true }),
    ).toBeVisible();
    await chrome
      .getByRole('checkbox', { name: 'Block ads and trackers for this site' })
      .click();
    await expect(
      chrome.getByRole('checkbox', {
        name: 'Block ads and trackers for this site',
      }),
    ).not.toBeChecked();
    await chrome.getByLabel('Close dialog', { exact: true }).click();
    await chrome.evaluate(() => window.drift.action('reload'));
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          (
            BrowserWindow.getAllWindows()[0].contentView
              .children[0] as Electron.WebContentsView
          ).webContents.executeJavaScript('window.adLoaded'),
        ),
      )
      .toBe(true);
    const cookies = await app.evaluate(async ({ BrowserWindow }) => {
      const page = (
        BrowserWindow.getAllWindows()[0].contentView
          .children[0] as Electron.WebContentsView
      ).webContents;
      return page.session.cookies.get({ name: 'third' });
    });
    expect(cookies).toEqual([]);
    await app.evaluate(
      async ({ BrowserWindow }, url) => {
        const page = (
          BrowserWindow.getAllWindows()[0].contentView
            .children[0] as Electron.WebContentsView
        ).webContents;
        await page.session.cookies.set({
          url,
          name: 'existing',
          value: 'secret',
          sameSite: 'no_restriction',
          secure: true,
        });
      },
      `http://localhost:${(server.address() as AddressInfo).port}/`,
    );
    await chrome.evaluate(() => window.drift.action('reload'));
    await expect.poll(() => seen.length).toBeGreaterThan(3);
    expect(seen.every((value) => !value.includes('existing=secret'))).toBe(
      true,
    );
    await chrome.evaluate(() => window.drift.action('private-window'));
    let privateChrome = chrome;
    await expect
      .poll(async () => {
        for (const page of app
          .windows()
          .filter(
            (p) =>
              p.url().startsWith('file:') ||
              p.url() === 'http://127.0.0.1:5173/',
          )) {
          if (
            await page.evaluate(() =>
              window.drift.getState().then((state) => state.privateWindow),
            )
          ) {
            privateChrome = page;
            return true;
          }
        }
        return false;
      })
      .toBe(true);
    await privateChrome.evaluate(
      (url) => window.drift.navigate(url),
      `${origin}/private`,
    );
    expect(
      (await chrome.evaluate(() => window.drift.getLibrary())).history.some(
        (item) => item.url.endsWith('/private'),
      ),
    ).toBe(false);
    await privateChrome.evaluate(() => window.drift.action('close'));
    await chrome.evaluate(() => window.drift.action('open-command'));
    await expect(
      chrome.getByRole('combobox', { name: 'Web address' }),
    ).toBeFocused();
    await chrome.getByRole('combobox', { name: 'Web address' }).press('Escape');
    await app
      .context()
      .route('https://insecure.test/**', (route) => route.abort('failed'));
    await chrome.evaluate(() => window.drift.navigate('http://insecure.test/'));
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getShields().then((state) => state.pendingHTTP),
        ),
      )
      .toBe('http://insecure.test/');
    expect(seen.every((cookie) => !cookie.includes('third=secret'))).toBe(true);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
