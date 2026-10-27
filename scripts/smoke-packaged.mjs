import { _electron as electron, expect } from '@playwright/test';
import path from 'node:path';
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const exe = path.resolve('release/win-unpacked/Drift.exe');
const app = await electron.launch({
  executablePath: exe,
  args: [
    `--user-data-dir=${path.resolve('test-results', `packaged-${Date.now()}`)}`,
  ],
  env,
});
try {
  let chrome;
  await expect
    .poll(() => {
      chrome = app
        .windows()
        .find((p) => p.url().includes('/renderer/index.html'));
      return Boolean(chrome);
    })
    .toBe(true);
  await chrome.waitForFunction(
    () => typeof window.drift?.getState === 'function',
  );
  await expect(chrome.locator('aside footer button')).toHaveCount(2);
  await expect
    .poll(() =>
      chrome.evaluate(() => window.drift.getState().then((s) => s.loading)),
    )
    .toBe(false);
  const metadata = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    path: app.getAppPath(),
  }));
  if (!metadata.packaged) throw new Error('Expected a packaged application');
  await chrome.evaluate(() => window.drift.action('show-shields'));
  await expect(
    chrome.getByRole('dialog', { name: 'Shields', exact: true }),
  ).toBeVisible();
  await chrome.getByLabel('Close dialog', { exact: true }).click();
  await chrome.evaluate(() => window.drift.action('show-settings'));
  await expect(
    chrome.getByRole('dialog', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await chrome.getByText('Browser tools', { exact: true }).click();
  await expect(
    chrome.getByRole('button', { name: 'Downloads', exact: true }),
  ).toBeVisible();
  await chrome.screenshot({ path: 'test-results/phase7-packaged.png' });
  console.log(JSON.stringify({ status: 'passed', ...metadata }));
} finally {
  await app.close();
}
