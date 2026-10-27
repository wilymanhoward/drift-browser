import { expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
export async function openBrowserTool(chrome: Page, name: string) {
  await chrome.getByRole('button', { name: 'Settings', exact: true }).click();
  await chrome.getByText('Browser tools', { exact: true }).click();
  await chrome.getByRole('button', { name, exact: true }).click();
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
