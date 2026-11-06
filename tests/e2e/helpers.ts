import { expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
export async function openBrowserTool(chrome: Page, name: string) {
  if (name === 'Reopen closed tab') {
    await chrome.evaluate(() => window.drift.action('reopen-tab'));
    return;
  }
  await chrome.evaluate(() => window.drift.action('show-menu'));
  await chrome.getByRole('menuitem', { name, exact: true }).click();
  await expect(chrome.getByRole('dialog', { name, exact: true })).toBeVisible();
}

export async function pinSidebar(chrome: Page) {
  await chrome.getByRole('complementary').hover();
  await chrome.getByLabel('Pin sidebar open', { exact: true }).click();
}

export async function chromeWindow(app: ElectronApplication): Promise<Page> {
  let chrome: Page | undefined;
  // Playwright also reports WebContentsView pages as windows during restore.
  await expect
    .poll(
      () => {
        chrome = app
          .windows()
          .find(
            (page) =>
              /^file:.*\/renderer\/index\.html$/.test(page.url()) ||
              page.url() === 'http://127.0.0.1:5173/',
          );
        return Boolean(chrome);
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await expect(chrome!.getByRole('complementary')).toBeVisible();
  return chrome!;
}
