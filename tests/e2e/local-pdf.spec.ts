import { _electron as electron, expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromeWindow } from './helpers';

test('a PDF file from this computer opens in the PDF viewer', async () => {
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
    const file = test.info().outputPath('My Notes.pdf');
    await writeFile(
      file,
      Buffer.from(
        await app.evaluate(async ({ BrowserWindow }) => {
          const fixture = new BrowserWindow({ show: false });
          try {
            await fixture.loadURL('data:text/html,<h1>Local PDF page</h1>');
            return Array.from(await fixture.webContents.printToPDF({}));
          } finally {
            fixture.destroy();
          }
        }),
      ),
    );
    const url = pathToFileURL(file).href;
    // Typed as a Windows path, as it would be pasted into the address bar.
    await chrome.evaluate((path) => window.drift.navigate(path), file);
    await expect
      .poll(() => app.windows().some((page) => page.url() === url))
      .toBe(true);
    const page = app.windows().find((p) => p.url() === url)!;
    await expect
      .poll(() =>
        page
          .frames()
          .some((frame) =>
            frame
              .url()
              .startsWith(
                'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/',
              ),
          ),
      )
      .toBe(true);
    const viewer = page
      .frames()
      .find((frame) =>
        frame
          .url()
          .startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'),
      )!;
    await expect(viewer.locator('pdf-viewer')).toBeVisible();
    expect((await chrome.evaluate(() => window.drift.getState())).url).toBe(
      url,
    );
    // Other local files stay closed.
    const refused = await chrome.evaluate(
      (path) =>
        window.drift.navigate(path).then(
          () => 'opened',
          () => 'refused',
        ),
      file.replace(/\.pdf$/, '.txt'),
    );
    expect(refused).toBe('refused');
  } finally {
    await app.close();
  }
});
