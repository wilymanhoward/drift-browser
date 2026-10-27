import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';
import type { Page } from '@playwright/test';
async function navigate(chrome: Page, url: string) {
  await chrome.evaluate(() => window.drift.action('open-command'));
  await chrome.getByLabel('Web address', { exact: true }).fill(url);
  await chrome.getByLabel('Web address', { exact: true }).press('Enter');
}

test('Phase 1 browses with isolated content and working window controls', async () => {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(
      `<html><head><title>${request.url === '/two' ? 'Second page' : 'First page'}</title></head><body><h1>Local browsing fixture</h1><a href="/two">Second page</a></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
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
    const chrome = await chromeWindow(app);
    const errors: string[] = [];
    chrome.on('pageerror', (error) => errors.push(error.message));
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '48px');
    await chrome.getByLabel('Pin sidebar open', { exact: true }).click();
    await expect(chrome.getByLabel('Edit web address')).toBeVisible();
    await expect(chrome.getByRole('complementary')).toHaveCSS('width', '224px');
    await navigate(chrome, `${origin}/one`);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'First page',
    );
    await navigate(chrome, `${origin}/two`);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Second page',
    );
    await expect(chrome.getByLabel('Back', { exact: true })).toBeEnabled();
    await chrome.getByLabel('Back', { exact: true }).click();
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'First page',
    );
    await chrome.getByLabel('Forward', { exact: true }).click();
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'Second page',
    );
    await chrome.getByLabel('Reload', { exact: true }).click();
    await expect(chrome.getByRole('status')).toHaveText('Ready');
    await navigate(chrome, 'javascript:alert(1)');
    await expect(chrome.getByRole('alert')).toContainText(
      'valid address or search term',
    );
    await chrome.getByLabel('Web address', { exact: true }).press('Escape');
    await expect(chrome.getByRole('dialog')).toHaveCount(0);
    await chrome.getByLabel('Edit web address').click();
    await expect(chrome.getByLabel('Web address', { exact: true })).toHaveValue(
      `${origin}/two`,
    );
    await expect(
      chrome.getByLabel('Web address', { exact: true }),
    ).toBeFocused();
    await chrome.getByLabel('Web address', { exact: true }).press('Shift+Tab');
    await expect(
      chrome.getByLabel('Close dialog', { exact: true }),
    ).toBeFocused();
    await chrome.getByLabel('Close dialog', { exact: true }).press('Enter');
    await expect(chrome.getByRole('status')).toHaveText('Ready');
    const security = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const view = win.contentView.children[0] as Electron.WebContentsView;
      return {
        globals: await view.webContents.executeJavaScript(
          '({ node: typeof process, require: typeof require, bridge: typeof window.drift })',
        ),
        bounds: view.getBounds(),
        size: win.getContentSize(),
      };
    });
    expect(security).toMatchObject({
      globals: { node: 'undefined', require: 'undefined', bridge: 'undefined' },
    });
    expect(security.bounds.width).toBe(security.size[0] - 232);
    expect(security.bounds.height).toBe(security.size[1] - 16);
    const rejected = await chrome.evaluate(async () => {
      try {
        await window.drift.action('invalid' as never);
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);
    await chrome.getByLabel('Maximize window', { exact: true }).click();
    await expect(
      chrome.getByLabel('Restore window', { exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Restore window', { exact: true }).click();
    await expect(
      chrome.getByLabel('Maximize window', { exact: true }),
    ).toBeVisible();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(640, 440),
    );
    expect(
      await chrome.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1320, 860),
    );
    await chrome.screenshot({ path: 'test-results/phase-1-chrome.png' });
    await navigate(chrome, 'http://127.0.0.1:1');
    await expect(chrome.getByRole('alert')).toContainText(
      'could not be loaded',
    );
    await navigate(chrome, `${origin}/one`);
    await expect(chrome.getByRole('tab', { selected: true })).toHaveText(
      'First page',
    );
    await expect(chrome.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
    await chrome.getByLabel('Minimize window', { exact: true }).click();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isMinimized(),
        ),
      )
      .toBe(true);
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.restore();
      win.show();
    });
    const closed = app.waitForEvent('close');
    await chrome.getByLabel('Close window', { exact: true }).click();
    await closed;
  } finally {
    await app.close().catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('hover-expanded window controls stay reachable across the header', async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${test.info().outputPath('hover-profile')}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    const sidebar = chrome.getByRole('complementary');
    await chrome.mouse.move(16, 140);
    await expect(sidebar).toHaveCSS('width', '224px');
    // Reproduce the native mouse-exit event when entering the draggable label.
    await sidebar.dispatchEvent('mouseout', {
      bubbles: true,
      relatedTarget: null,
      clientX: 28,
      clientY: 20,
    });
    await chrome.waitForTimeout(400);
    await expect(sidebar).toHaveCSS('width', '224px');
    expect(
      (await chrome.evaluate(() => window.drift.getState())).sidebar.pinned,
    ).toBe(false);
    await chrome.mouse.move(80, 20, { steps: 12 });
    await chrome.getByLabel('Maximize window', { exact: true }).hover();
    await chrome.waitForTimeout(400);
    await expect(sidebar).toHaveCSS('width', '224px');
    await chrome.getByLabel('Maximize window', { exact: true }).click();
    await expect(
      chrome.getByLabel('Restore window', { exact: true }),
    ).toBeVisible();
    await chrome.getByLabel('Restore window', { exact: true }).click();
    await chrome.getByLabel('Minimize window', { exact: true }).hover();
    await chrome.waitForTimeout(400);
    await chrome.getByLabel('Minimize window', { exact: true }).click();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isMinimized(),
        ),
      )
      .toBe(true);
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.restore();
      win.show();
    });
    await chrome.mouse.move(16, 140);
    await expect(sidebar).toHaveCSS('width', '224px');
    await chrome.getByLabel('Close window', { exact: true }).hover();
    await chrome.waitForTimeout(400);
    const closed = app.waitForEvent('close');
    await chrome.getByLabel('Close window', { exact: true }).click();
    await closed;
  } finally {
    await app.close().catch(() => {});
  }
});
