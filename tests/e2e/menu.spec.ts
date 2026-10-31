import { test, expect, _electron as electron } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chromeWindow } from './helpers';

test('Drift browser menu supports keyboard, zoom, settings and new windows', async () => {
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
    const page = await chromeWindow(app);
    await page.evaluate(async () => {
      const state = await window.drift.getState();
      await window.drift.settings({
        ...state.settings,
        theme: 'dark',
        toolbarLayout: 'top',
        autoHideTopBar: false,
      });
    });
    const open = () =>
      page.getByRole('button', { name: 'Browser menu', exact: true }).click();
    const menu = page.getByRole('dialog', {
      name: 'Browser menu',
      exact: true,
    });
    await open();
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: /^New tab/ }),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(
      menu.getByRole('menuitem', { name: 'New window', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await open();
    await menu.getByRole('menuitem', { name: 'Zoom in', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.drift.getState())).zoomPercent,
      )
      .toBeGreaterThan(100);
    await expect(menu).toBeVisible();
    await menu
      .getByRole('menuitem', { name: 'Reset zoom', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.drift.getState())).zoomPercent,
      )
      .toBe(100);
    expect(
      (
        await new AxeBuilder({ page })
          .setLegacyMode(true)
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('drift-menu.png') });
    await menu.screenshot({
      path: test.info().outputPath('drift-menu-panel.png'),
    });
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const state = await window.drift.getState();
      await window.drift.settings({ ...state.settings, theme: 'light' });
    });
    await open();
    expect(
      (
        await new AxeBuilder({ page })
          .setLegacyMode(true)
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath('drift-menu-light.png'),
    });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(720, 600),
    );
    await expect
      .poll(() =>
        menu.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return (
            r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
          );
        }),
      )
      .toBe(true);
    await menu.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Import from browser', exact: true }),
    ).toBeVisible();
    await open();
    await page.mouse.click(10, 300);
    await expect(menu).toHaveCount(0);
    await open();
    await menu
      .getByRole('menuitem', { name: 'New window', exact: true })
      .click();
    await expect
      .poll(
        () =>
          app
            .windows()
            .filter((page) => page.url().includes('/renderer/index.html'))
            .length,
      )
      .toBe(2);
  } finally {
    await app.close();
  }
});
