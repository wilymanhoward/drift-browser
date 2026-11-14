import { _electron as electron, expect, test } from '@playwright/test';
import { chromeWindow } from './helpers';

test('the sidebar follows the side of the screen the window sits on', async () => {
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
    const side = () =>
      chrome.evaluate(() =>
        window.drift.getState().then((state) => state.sidebarPosition),
      );
    // Placed as Windows' snap would place it: one half of the screen.
    const place = (half: 'left' | 'right' | 'middle') =>
      app.evaluate(({ BrowserWindow, screen }, half) => {
        const win = BrowserWindow.getAllWindows()[0];
        const area = screen.getDisplayMatching(win.getBounds()).workArea;
        const width = Math.round(area.width / 2);
        win.setBounds(
          half === 'middle'
            ? {
                x: area.x + 100,
                y: area.y + 80,
                width,
                height: area.height - 200,
              }
            : {
                x: half === 'left' ? area.x : area.x + area.width - width,
                y: area.y,
                width,
                height: area.height,
              },
        );
      }, half);
    await place('right');
    await expect.poll(side).toBe('right');
    await expect(chrome.getByRole('complementary')).toBeVisible();
    await place('left');
    await expect.poll(side).toBe('left');
    await place('right');
    await expect.poll(side).toBe('right');
    // Floating again, it goes back to the setting (left by default).
    await place('middle');
    await expect.poll(side).toBe('left');
  } finally {
    await app.close();
  }
});
