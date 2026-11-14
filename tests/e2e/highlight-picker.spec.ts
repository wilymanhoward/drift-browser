import { _electron as electron, expect, test } from '@playwright/test';
import { chromeWindow } from './helpers';

test('the highlight color is chosen from a list of palettes in Settings', async () => {
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
    const highlight = () =>
      chrome.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--highlight')
          .trim(),
      );
    // Dark is the fresh-install theme; Ember is the default palette.
    await expect.poll(highlight).toBe('#f4a26b');
    await chrome.evaluate(() => window.drift.action('show-settings'));
    await chrome
      .getByRole('navigation', { name: 'Settings categories' })
      .getByRole('button', { name: 'Look and feel', exact: true })
      .click();
    const picker = chrome.getByRole('radiogroup', { name: 'Highlight' });
    await expect(picker.getByRole('radio')).toHaveCount(5);
    await expect(picker.getByRole('radio', { name: 'Ember' })).toBeChecked();
    await picker.getByText('Glacier', { exact: true }).click();
    await expect(picker.getByRole('radio', { name: 'Glacier' })).toBeChecked();
    await expect.poll(highlight).toBe('#8fd3fe');
    // Arrow keys move between palettes, as with any radio group.
    await picker.getByRole('radio', { name: 'Glacier' }).press('ArrowRight');
    await expect
      .poll(() =>
        chrome.evaluate(() =>
          window.drift.getState().then((s) => s.settings.highlight),
        ),
      )
      .toBe('aurora');
    await expect.poll(highlight).toBe('#6fd8b8');
    await chrome.screenshot({
      path: test.info().outputPath('picker.png'),
      clip: (await picker.boundingBox())!,
    });
  } finally {
    await app.close();
  }
});
