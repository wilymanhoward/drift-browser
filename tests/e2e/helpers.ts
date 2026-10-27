import { expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

export async function chromeWindow(app: ElectronApplication): Promise<Page> {
  let chrome: Page | undefined;
  // Playwright also reports WebContentsView pages as windows during restore.
  await expect
    .poll(() => {
      chrome = app
        .windows()
        .find(
          (page) =>
            /^file:.*\/renderer\/index\.html$/.test(page.url()) ||
            page.url() === 'http://127.0.0.1:5173/',
        );
      return Boolean(chrome);
    })
    .toBe(true);
  await expect(chrome!.getByRole('complementary')).toBeVisible();
  return chrome!;
}
