import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { chromeWindow } from './helpers';

function environment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}
test('General settings shows default browser availability, action, refresh and errors', async () => {
  test.setTimeout(60000);
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  const app = await electron.launch({
    ...(executablePath && { executablePath }),
    args: [
      ...(executablePath ? [] : ['.']),
      `--user-data-dir=${test.info().outputPath('profile')}`,
    ],
    env: environment(),
  });
  try {
    const page = await chromeWindow(app);
    await page.evaluate(() => window.drift.action('show-settings'));
    const button = page.getByRole('button', {
      name: 'Make default',
      exact: true,
    });
    await expect(button).toBeDisabled();
    await expect(
      page.getByText(
        'Install Drift with the Windows installer to enable this option.',
      ),
    ).toBeVisible();
    const model = await app.evaluateHandle(({ ipcMain }) => {
      const model = { isDefault: false, fail: false, opened: 0 };
      ipcMain.removeHandler('drift:default-browser');
      ipcMain.handle('drift:default-browser', (_event, command) => {
        if (command === 'open-settings') {
          if (model.fail) throw new Error('Test Settings launch failure');
          model.opened++;
        }
        return { supported: true, installed: true, isDefault: model.isDefault };
      });
      return model;
    });
    const refresh = () =>
      page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await refresh();
    await expect(button).toBeEnabled();
    await button.click();
    expect(await model.evaluate((model) => model.opened)).toBe(1);
    await page.screenshot({
      path: test.info().outputPath('default-browser-dark.png'),
    });
    await model.evaluate((model) => {
      model.isDefault = true;
    });
    await refresh();
    await expect(
      page.getByRole('button', { name: 'Already default', exact: true }),
    ).toBeDisabled();
    await model.evaluate((model) => {
      model.isDefault = false;
      model.fail = true;
    });
    await refresh();
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByRole('alert')).toContainText(
      'Windows Default apps could not be opened',
    );
    await page.evaluate(async () => {
      const state = await window.drift.getState();
      await window.drift.settings({ ...state.settings, theme: 'light' });
    });
    await page.screenshot({
      path: test.info().outputPath('default-browser-light.png'),
    });
    await model.dispose();
  } finally {
    await app.close();
  }
});

test('Windows link launches reach an existing regular window instead of another process or private tab', async () => {
  test.setTimeout(60000);
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<title>External ${req.url}</title><h1>External link</h1>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  const profile = test.info().outputPath('profile');
  const args = [...(executablePath ? [] : ['.']), `--user-data-dir=${profile}`];
  const env = environment();
  const app = await electron.launch({
    ...(executablePath && { executablePath }),
    args: [...args, '--', origin + '/cold?one=1&two=2'],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    const state = () => chrome.evaluate(() => window.drift.getState());
    await expect
      .poll(async () => (await state()).url)
      .toBe(origin + '/cold?one=1&two=2');
    const exe = await app.evaluate(({ app }) => app.getPath('exe'));
    const deliver = (url: string) =>
      new Promise<void>((resolve, reject) => {
        const process = spawn(exe, [...args, '--', url], {
          env,
          windowsHide: true,
          stdio: 'ignore',
        });
        process.once('error', reject);
        process.once('exit', (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`Second process exited ${code}`)),
        );
      });
    await chrome.evaluate(() => window.drift.action('open-command'));
    await deliver(origin + '/warm');
    await expect.poll(async () => (await state()).url).toBe(origin + '/warm');
    expect((await state()).overlay).toBeNull();
    expect(
      app
        .windows()
        .filter((page) => page.url().includes('/renderer/index.html')),
    ).toHaveLength(1);
    await chrome.evaluate(() => window.drift.action('private-window'));
    await expect
      .poll(
        () =>
          app
            .windows()
            .filter((page) => page.url().includes('/renderer/index.html'))
            .length,
      )
      .toBe(2);
    const privatePage = app
      .windows()
      .find(
        (page) =>
          page !== chrome && page.url().includes('/renderer/index.html'),
      )!;
    await privatePage.waitForFunction(
      () => typeof window.drift?.getState === 'function',
    );
    const privateWin = await app.browserWindow(privatePage);
    await privateWin.evaluate((win) => win.focus());
    await deliver(origin + '/regular-only');
    await expect
      .poll(async () => (await state()).url)
      .toBe(origin + '/regular-only');
    expect(
      await privatePage.evaluate(() =>
        window.drift.getState().then((state) => state.tabs.length),
      ),
    ).toBe(1);
    const count = (await state()).tabs.length;
    await deliver('javascript:alert(1)');
    expect((await state()).tabs).toHaveLength(count);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
