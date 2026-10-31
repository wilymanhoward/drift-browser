import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';

async function launch(profile: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  return electron.launch({
    ...(executablePath && { executablePath }),
    args: [...(executablePath ? [] : ['.']), `--user-data-dir=${profile}`],
    env,
  });
}
const state = (chrome: Page) => chrome.evaluate(() => window.drift.getState());
// The drop point is wherever the cursor is when the drag ends.
const dropAt = (app: ElectronApplication, x: number, y: number) =>
  app.evaluate(
    ({ screen }, point) => {
      screen.getCursorScreenPoint = () => point;
    },
    { x, y },
  );
const pageValue = (app: ElectronApplication, index: number) =>
  app.evaluate(({ BrowserWindow }, index) => {
    const win = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id)[
      index
    ];
    const view = win.contentView.children.find((v) =>
      v.getVisible(),
    ) as Electron.WebContentsView;
    return view.webContents.executeJavaScript(
      "document.getElementById('kept').value",
    );
  }, index);

test('side-by-side windows keep their sidebars at the outside edges', async () => {
  const app = await launch(test.info().outputPath('profile'));
  try {
    const left = await chromeWindow(app);
    const area = await app.evaluate(
      ({ screen }) => screen.getPrimaryDisplay().workArea,
    );
    test.skip(
      area.width < 1280,
      'Two Drift windows need at least 1280px of display width.',
    );
    await left.evaluate(() => window.drift.action('new-tab'));
    await left.evaluate(() => window.drift.closeOverlay());
    const moving = (await state(left)).activeTabId;
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({
        x: 0,
        y: 0,
        width: 700,
        height: 500,
      }),
    );
    await dropAt(app, 1500, 800);
    await left.evaluate(
      (id) => window.drift.tab({ type: 'detach', id }),
      moving,
    );
    const chromePages = () =>
      app.windows().filter((page) => /renderer\/index\.html$/.test(page.url()));
    await expect.poll(() => chromePages().length).toBe(2);
    const right = chromePages().find((page) => page !== left)!;
    await right.waitForFunction(
      () => typeof window.drift?.getState === 'function',
    );
    await app.evaluate(({ BrowserWindow }, area) => {
      const windows = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id);
      const width = Math.floor(area.width / 2);
      windows[0].setBounds({
        x: area.x,
        y: area.y,
        width,
        height: area.height,
      });
      windows[1].setBounds({
        x: area.x + width,
        y: area.y,
        width: area.width - width,
        height: area.height,
      });
    }, area);
    await expect
      .poll(async () => (await state(left)).sidebarPosition)
      .toBe('left');
    await expect
      .poll(async () => (await state(right)).sidebarPosition)
      .toBe('right');
    expect((await state(right)).settings.sidebarPosition).toBe('left');
    await expect
      .poll(() =>
        right
          .locator('aside')
          .evaluate((aside) => Math.round(aside.getBoundingClientRect().right)),
      )
      .toBe(await right.evaluate(() => innerWidth));
    const nativeX = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id)[1];
      return win.contentView.children
        .find((view) => view.getVisible())!
        .getBounds().x;
    });
    expect(nativeX).toBe((await state(right)).settings.contentInset ? 8 : 0);
    await right.screenshot({
      path: test.info().outputPath('right-sidebar.png'),
    });
    const rightBounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .sort((a, b) => a.id - b.id)[1]
        .getBounds(),
    );
    await app.evaluate(
      ({ BrowserWindow }, x) =>
        BrowserWindow.getAllWindows()
          .sort((a, b) => a.id - b.id)[1]
          .setPosition(x, 0),
      area.x + 100,
    );
    await expect
      .poll(async () => (await state(right)).sidebarPosition)
      .toBe('left');
    await app.evaluate(
      ({ BrowserWindow }, bounds) =>
        BrowserWindow.getAllWindows()
          .sort((a, b) => a.id - b.id)[1]
          .setBounds(bounds),
      rightBounds,
    );
    await expect
      .poll(async () => (await state(right)).sidebarPosition)
      .toBe('right');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .sort((a, b) => a.id - b.id)[0]
        .hide(),
    );
    await expect
      .poll(async () => (await state(right)).sidebarPosition)
      .toBe('left');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .sort((a, b) => a.id - b.id)[0]
        .show(),
    );
    await expect
      .poll(async () => (await state(right)).sidebarPosition)
      .toBe('right');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .sort((a, b) => a.id - b.id)[0]
        .close(),
    );
    await expect
      .poll(async () => (await state(right)).sidebarPosition)
      .toBe('left');
  } finally {
    await app.close();
  }
});

test('a tab dropped outside its window moves live into a new window', async () => {
  const server = createServer((req, res) => {
    const title = req.url === '/two' ? 'Second page' : 'First page';
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<html><head><title>${title}</title></head><body><input id="kept"></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let app: ElectronApplication | undefined;
  try {
    app = await launch(test.info().outputPath('profile'));
    const chrome = await chromeWindow(app);
    await chrome.evaluate((url) => window.drift.navigate(url), `${origin}/one`);
    await chrome.evaluate(() => window.drift.action('new-tab'));
    await chrome.evaluate(() => window.drift.closeOverlay());
    await chrome.evaluate((url) => window.drift.navigate(url), `${origin}/two`);
    await expect
      .poll(async () => (await state(chrome)).title)
      .toBe('Second page');
    const moving = (await state(chrome)).activeTabId;
    await app.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
        (v) => v.getVisible(),
      ) as Electron.WebContentsView;
      return view.webContents.executeJavaScript(
        "document.getElementById('kept').value='typed before the move'",
      );
    });

    // Dropping inside the window leaves everything where it was.
    const bounds = { x: 0, y: 0, width: 700, height: 500 };
    await app.evaluate(
      ({ BrowserWindow }, bounds) =>
        BrowserWindow.getAllWindows()[0].setBounds(bounds),
      bounds,
    );
    await dropAt(app, bounds.x + 100, bounds.y + 100);
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'detach', id }),
      moving,
    );
    expect(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
    ).toBe(1);

    await dropAt(app, 1500, 800);
    await chrome.locator(`[data-tab-id="${moving}"]`).evaluate((row) => {
      const dataTransfer = new DataTransfer();
      row.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      );
      row.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, dataTransfer }),
      );
    });
    await expect
      .poll(() =>
        app!.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().filter((w) => w.isVisible()).length,
        ),
      )
      .toBe(2);
    const after = await state(chrome);
    expect(after.tabs.map((t) => t.title)).toEqual(['First page']);
    const second = app
      .windows()
      .filter((page) => /renderer\/index\.html$/.test(page.url()))
      .find((page) => page !== chrome)!;
    await expect
      .poll(async () => (await state(second)).tabs.map((t) => t.id))
      .toEqual([moving]);
    // Same page, not a reload: what was typed is still there.
    expect(await pageValue(app, 1)).toBe('typed before the move');

    // Dropping onto the first window brings it back and closes the emptied one.
    await dropAt(app, bounds.x + 200, bounds.y + 200);
    // The emptied window closes before the call can answer.
    await second
      .evaluate((id) => window.drift.tab({ type: 'detach', id }), moving)
      .catch(() => {});
    await expect
      .poll(() =>
        app!.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
        ),
      )
      .toBe(1);
    await expect
      .poll(async () => (await state(chrome)).tabs.map((t) => t.title))
      .toEqual(['First page', 'Second page']);
    expect(await pageValue(app, 0)).toBe('typed before the move');

    // With only one tab, carry the existing window instead of reloading it.
    const first = (await state(chrome)).tabs.find((tab) => tab.id !== moving)!;
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'close', id }),
      first.id,
    );
    await dropAt(app, 1500, 800);
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'detach', id }),
      moving,
    );
    expect(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
    ).toBe(1);
    expect((await state(chrome)).activeTabId).toBe(moving);
    expect(await pageValue(app, 0)).toBe('typed before the move');
  } finally {
    await app?.close();
    server.close();
  }
});

test('tearing off a private tab keeps both windows private', async () => {
  const app = await launch(test.info().outputPath('profile'));
  try {
    const regular = await chromeWindow(app);
    await regular.evaluate(() => window.drift.action('private-window'));
    const chromePages = () =>
      app.windows().filter((page) => /renderer\/index\.html$/.test(page.url()));
    await expect.poll(() => chromePages().length).toBe(2);
    const source = chromePages().find((page) => page !== regular)!;
    await source.waitForFunction(
      () => typeof window.drift?.getState === 'function',
    );
    await source.evaluate(() => window.drift.action('new-tab'));
    await source.evaluate(() => window.drift.closeOverlay());
    const moving = (await state(source)).activeTabId;
    await app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows())
        win.setBounds({ x: 0, y: 0, width: 700, height: 500 });
    });
    await dropAt(app, 1500, 800);
    await source.evaluate(
      (id) => window.drift.tab({ type: 'detach', id }),
      moving,
    );
    await expect.poll(() => chromePages().length).toBe(3);
    const target = chromePages().find(
      (page) => page !== regular && page !== source,
    )!;
    await target.waitForFunction(
      () => typeof window.drift?.getState === 'function',
    );
    expect((await state(target)).privateWindow).toBe(true);
    expect((await state(source)).privateWindow).toBe(true);
    expect((await state(regular)).privateWindow).toBe(false);
    expect((await state(target)).tabs.map((tab) => tab.id)).toEqual([moving]);
    expect((await state(source)).tabs.some((tab) => tab.id === moving)).toBe(
      false,
    );
  } finally {
    await app.close();
  }
});
