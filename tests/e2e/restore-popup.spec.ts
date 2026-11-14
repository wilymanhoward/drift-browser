import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';

test('after a restart that opens a new tab, a popup offers the last tabs back', async () => {
  test.setTimeout(60000);
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<title>Page ${req.url}</title>${req.url}`);
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
  // The popup is its own page; this runs a script in it from the main process.
  const popup = (app: ElectronApplication, script: string) =>
    app.evaluate(async ({ webContents }, script) => {
      const page = webContents
        .getAllWebContents()
        .find(
          (p) =>
            !p.isDestroyed() &&
            p.getURL().startsWith('data:text/html') &&
            p.getURL().includes('Restore%20tabs'),
        );
      return page ? page.executeJavaScript(script) : null;
    }, script);
  let app = await launch();
  try {
    let chrome = await chromeWindow(app);
    await chrome.evaluate(async () => {
      const state = await window.drift.getState();
      await window.drift.settings({ ...state.settings, startup: 'new-tab' });
    });
    await chrome.evaluate((url) => window.drift.navigate(url), `${origin}/one`);
    const first = (await chrome.evaluate(() => window.drift.getState()))
      .activeTabId;
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'duplicate', id }),
      first,
    );
    await chrome.evaluate((url) => window.drift.navigate(url), `${origin}/two`);
    await expect
      .poll(async () =>
        (await chrome.evaluate(() => window.drift.getState())).tabs.map(
          (t) => t.url,
        ),
      )
      .toEqual([`${origin}/one`, `${origin}/two`]);
    await app.close();

    app = await launch();
    chrome = await chromeWindow(app);
    // A new tab opened, as the setting asks, and the popup offers the rest.
    expect(
      (await chrome.evaluate(() => window.drift.getState())).tabs.map(
        (t) => t.url,
      ),
    ).toEqual(['drift://newtab/']);
    await expect
      .poll(() => popup(app, `document.getElementById('detail')?.textContent`))
      .toBe('2 tabs from last time.');
    await popup(app, `document.getElementById('restore').click()`);
    await expect
      .poll(async () =>
        (await chrome.evaluate(() => window.drift.getState())).tabs.map(
          (t) => t.url,
        ),
      )
      .toEqual([`${origin}/one`, `${origin}/two`]);
    // The card is gone once answered.
    await expect.poll(() => popup(app, '1')).toBeNull();
    await app.close();

    // Restored, they are the last session again; Not now keeps the new tab.
    app = await launch();
    chrome = await chromeWindow(app);
    await expect
      .poll(() => popup(app, `document.getElementById('detail')?.textContent`))
      .toBe('2 tabs from last time.');
    await popup(app, `document.getElementById('dismiss').click()`);
    await expect.poll(() => popup(app, '1')).toBeNull();
    expect(
      (await chrome.evaluate(() => window.drift.getState())).tabs.map(
        (t) => t.url,
      ),
    ).toEqual(['drift://newtab/']);
  } finally {
    await app.close();
    server.close();
  }
});
