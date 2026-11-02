import { test, expect, _electron as electron } from '@playwright/test';
import { chromeWindow } from './helpers';

test('each new tab gets a fresh greeting while search and favourites stay usable', async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  const app = await electron.launch({
    ...(executablePath && { executablePath }),
    args: [
      ...(executablePath ? [] : ['.']),
      `--user-data-dir=${test.info().outputPath('profile')}`,
    ],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({
        x: 0,
        y: 0,
        width: 720,
        height: 600,
      }),
    );
    await expect
      .poll(() =>
        app.windows().some((page) => page.url() === 'drift://newtab/'),
      )
      .toBe(true);
    let page = app.windows().find((page) => page.url() === 'drift://newtab/')!;
    let previous = await page.getByRole('heading', { level: 1 }).innerText();
    for (let i = 0; i < 6; i++) {
      const before = app.windows();
      await chrome.evaluate(() => window.drift.action('new-tab'));
      await chrome.evaluate(() => window.drift.closeOverlay());
      await expect
        .poll(() =>
          app
            .windows()
            .some(
              (page) =>
                !before.includes(page) && page.url() === 'drift://newtab/',
            ),
        )
        .toBe(true);
      page = app
        .windows()
        .find(
          (page) => !before.includes(page) && page.url() === 'drift://newtab/',
        )!;
      const greeting = await page
        .getByRole('heading', { level: 1 })
        .innerText();
      expect(greeting.length).toBeGreaterThan(5);
      expect(greeting).not.toBe(previous);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await expect(page.getByRole('search')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Add site' })).toBeVisible();
      previous = greeting;
    }
    await page.screenshot({
      path: test.info().outputPath('newtab-greeting.png'),
    });
  } finally {
    await app.close();
  }
});
