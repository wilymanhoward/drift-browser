import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ElectronApplication } from '@playwright/test';
import { chromeWindow } from './helpers';

const page = (app: ElectronApplication, script: string) =>
  app.evaluate(
    ({ BrowserWindow }, code) =>
      (
        BrowserWindow.getAllWindows()[0].contentView
          .children[0] as Electron.WebContentsView
      ).webContents.executeJavaScript(code),
    script,
  );

// Drift's own password panel, a transparent view over the page.
const popup = (app: ElectronApplication, script: string) =>
  app.evaluate(({ BrowserWindow }, code) => {
    const view = BrowserWindow.getAllWindows()[0]
      .contentView.children.map(
        (child) => (child as Electron.WebContentsView).webContents,
      )
      .find((page) => page?.getURL().includes('window.choice'));
    return view ? view.executeJavaScript(code) : null;
  }, script);
const shot = async (app: ElectronApplication, file: string) => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const png = await app.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0]
      .contentView.children.map(
        (child) => (child as Electron.WebContentsView).webContents,
      )
      .find((page) => page?.getURL().includes('window.choice'))!;
    return (await view.capturePage()).toPNG().toString('base64');
  });
  await writeFile(file, Buffer.from(png, 'base64'));
};

test('saves a sign-in encrypted, fills it back, and deletes it', async () => {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<form onsubmit="event.preventDefault()"><input id="user" type="email"><input id="pass" type="password"><button id="go">Sign in</button></form>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}/`;
  const profile = test.info().outputPath('profile');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await chrome.evaluate((target) => window.drift.navigate(target), url);
    await expect.poll(() => page(app, 'location.href')).toBe(url);
    await expect
      .poll(() => page(app, 'Boolean(document.querySelector("#go"))'))
      .toBe(true);
    await page(
      app,
      `for (const [id, v] of [['user','me@example.com'],['pass','hunter2']]) { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } document.getElementById('go').click();`,
    );
    await expect
      .poll(() => popup(app, `document.querySelector('.title')?.textContent`))
      .toBe('Save password?');
    await shot(app, test.info().outputPath('save.png'));
    await popup(app, `document.querySelector('.primary').click()`);
    await expect
      .poll(() =>
        chrome.evaluate(() => window.drift.passwords({ type: 'list' })),
      )
      .toMatchObject({
        logins: [{ origin: url.slice(0, -1), username: 'me@example.com' }],
      });
    const file = await readFile(path.join(profile, 'passwords.json'), 'utf8');
    expect(file).not.toContain('hunter2');
    expect(file).not.toContain('me@example.com');

    await page(app, 'location.reload()');
    await expect
      .poll(() => page(app, 'Boolean(document.querySelector("#go"))'))
      .toBe(true);
    await page(app, `document.getElementById('user').click()`);
    await expect
      .poll(() =>
        popup(app, `document.querySelector('.row .name')?.textContent`),
      )
      .toBe('me@example.com');
    await shot(app, test.info().outputPath('fill.png'));
    await popup(app, `document.querySelector('.row').click()`);
    await expect
      .poll(() =>
        page(
          app,
          `document.getElementById('user').value + ' ' + document.getElementById('pass').value`,
        ),
      )
      .toBe('me@example.com hunter2');

    const { logins } = await chrome.evaluate(() =>
      window.drift.passwords({ type: 'list' }),
    );
    await chrome.evaluate(
      (id) => window.drift.passwords({ type: 'delete', id }),
      logins[0].id,
    );
    expect(
      (await chrome.evaluate(() => window.drift.passwords({ type: 'list' })))
        .logins,
    ).toEqual([]);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
