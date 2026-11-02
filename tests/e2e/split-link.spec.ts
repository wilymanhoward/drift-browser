import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { chromeWindow } from './helpers';

for (const privateWindow of [false, true]) {
  test(`Ctrl-click uses one temporary side preview (${privateWindow ? 'private' : 'regular'})`, async () => {
    test.setTimeout(60000);
    const server = createServer((req, res) => {
      if (req.url === '/broken') {
        req.socket.destroy();
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'none'; script-src 'none'",
      );
      res.end(
        `<title>${req.url}</title><input aria-label="Draft"><a href="/two"><span>Second page</span></a> <a href="/three" target="_blank">Third page</a> <a href="/four">Fourth page</a> <a href="/broken">Broken page</a> <a href="javascript:void(0)">Script link</a>`,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    delete env.ELECTRON_RUN_AS_NODE;
    const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
    const profile = test.info().outputPath('profile');
    const launch = () =>
      electron.launch({
        ...(executablePath && { executablePath }),
        args: [...(executablePath ? [] : ['.']), `--user-data-dir=${profile}`],
        env,
      });
    let app = await launch();
    try {
      let chrome = await chromeWindow(app);
      await app.evaluate(({ systemPreferences }) => {
        const settings = systemPreferences.getAnimationSettings();
        systemPreferences.getAnimationSettings = () => ({
          ...settings,
          prefersReducedMotion: false,
        });
      });
      if (privateWindow) {
        const regular = chrome;
        await regular.evaluate(() => window.drift.action('private-window'));
        await expect
          .poll(
            () =>
              app
                .windows()
                .filter((page) => page.url().includes('/renderer/index.html'))
                .length,
          )
          .toBe(2);
        chrome = app
          .windows()
          .find(
            (page) =>
              page !== regular && page.url().includes('/renderer/index.html'),
          )!;
        await chrome.waitForFunction(
          () => typeof window.drift?.getState === 'function',
        );
        const regularWindow = await app.browserWindow(regular);
        await regularWindow.evaluate((win) => win.close());
        await expect.poll(() => regular.isClosed()).toBe(true);
      }
      const state = () => chrome.evaluate(() => window.drift.getState());
      expect((await state()).privateWindow).toBe(privateWindow);
      await chrome.evaluate(
        (url) => window.drift.navigate(url),
        origin + '/one',
      );
      await expect
        .poll(() =>
          app.windows().some((page) => page.url() === origin + '/one'),
        )
        .toBe(true);
      const source = app
        .windows()
        .find((page) => page.url() === origin + '/one')!;
      await source.getByLabel('Draft').fill('Keep my draft');
      const sourceId = (await state()).activeTabId;
      const open = async () => {
        await source.getByText('Second page').click({ modifiers: ['Control'] });
        await expect
          .poll(async () => (await state()).split?.preview)
          .toBe(true);
        await expect
          .poll(() =>
            app.windows().some((page) => page.url() === origin + '/two'),
          )
          .toBe(true);
        return app.windows().find((page) => page.url() === origin + '/two')!;
      };
      let preview = await open();
      expect((await state()).tabs).toHaveLength(1);
      await expect(chrome.getByRole('tab')).toHaveCount(1);
      await preview.getByLabel('Draft').fill('Preview draft');
      expect((await state()).activeTabId).toBe(sourceId);
      await preview.getByText('Third page').click({ modifiers: ['Control'] });
      await expect(preview).toHaveURL(origin + '/three');
      expect((await state()).tabs).toHaveLength(1);
      expect((await state()).split?.ids[0]).toBe(sourceId);
      expect(
        app.windows().filter((page) => page.url().startsWith(origin)),
      ).toHaveLength(2);
      await preview.getByText('Fourth page').click();
      await expect(preview).toHaveURL(origin + '/four');
      await preview.getByText('Script link').click({ modifiers: ['Control'] });
      expect((await state()).tabs).toHaveLength(1);
      await expect(source.getByLabel('Draft')).toHaveValue('Keep my draft');
      const close = () => preview.locator('[data-drift-preview-close]');
      for (const side of ['left', 'right'] as const) {
        await chrome.evaluate(async (side) => {
          const s = await window.drift.getState();
          await window.drift.settings({
            ...s.settings,
            sidebarPosition: side,
            toolbarLayout: side === 'right' ? 'top' : 'sidebar',
            autoHideTopBar: false,
            contentInset: side === 'left',
            theme: side === 'left' ? 'dark' : 'light',
          });
        }, side);
        if (side === 'right')
          await chrome.evaluate(() => window.drift.action('find'));
        await expect(close()).toBeVisible();
        await chrome.waitForTimeout(300);
        const bounds = await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]
            .contentView.children.filter((view) => view.getVisible())
            .map((view) => view.getBounds())
            .sort((a, b) => a.x - b.x),
        );
        expect(bounds).toHaveLength(2);
        const button = (await close().boundingBox())!;
        expect(bounds[1].y).toBe(bounds[0].y);
        expect(bounds[1].height).toBe(bounds[0].height);
        expect(button.y).toBeCloseTo(10);
        expect(button.width).toBeCloseTo(32);
        expect(button.x + button.width).toBeLessThanOrEqual(bounds[1].width);
        if (side === 'right') {
          await app.evaluate(
            ({ webContents }, url) =>
              webContents
                .getAllWebContents()
                .find((page) => page.getURL() === url)!
                .focus(),
            preview.url(),
          );
          await chrome.evaluate(() => window.drift.action('zoom-in'));
          const zoom = await app.evaluate(
            ({ webContents }, url) =>
              webContents
                .getAllWebContents()
                .find((page) => page.getURL() === url)!
                .getZoomFactor(),
            preview.url(),
          );
          expect(zoom).toBeGreaterThan(1);
          await expect
            .poll(async () => (await close().boundingBox())!.width * zoom)
            .toBeCloseTo(32, 0);
          await chrome.evaluate(() => window.drift.action('zoom-reset'));
        }
        expect(await close().evaluate((host) => host.shadowRoot)).toBeNull();
        await preview.evaluate(() => {
          document.body.style.height = '3000px';
          window.scrollTo(0, 500);
        });
        expect((await close().boundingBox())!.y).toBeCloseTo(10);
        await close().evaluate((host) => (host as HTMLElement).click());
        expect((await state()).split?.preview).toBe(true);
        await preview.screenshot({
          path: test.info().outputPath(`preview-${side}.png`),
        });
        await preview.emulateMedia({
          reducedMotion: side === 'left' ? 'no-preference' : 'reduce',
        });
        const closeMessages = await app.evaluateHandle(
          ({ webContents }, url) => {
            const record = {
              reduced: [] as boolean[],
              animations: [] as number[],
            };
            const page = webContents
              .getAllWebContents()
              .find((page) => page.getURL() === url)!;
            page.on('ipc-message', (_event, channel, ...args) => {
              if (channel === 'drift:close-preview')
                record.reduced.push(args[0]);
            });
            const send = page.send.bind(page);
            page.send = (channel, ...args) => {
              if (channel === 'drift:preview-close-animation')
                record.animations.push(args[0]);
              send(channel, ...args);
            };
            return record;
          },
          preview.url(),
        );
        const closingEffect =
          side === 'left'
            ? preview.evaluate(
                () =>
                  new Promise<{
                    duration: number;
                    opacity: string;
                  }>((resolve) => {
                    const watch = () => {
                      const animation = document.documentElement
                        .getAnimations()
                        .find((animation) => animation.playState === 'running');
                      if (animation) {
                        const frames = (
                          animation.effect as KeyframeEffect
                        ).getKeyframes();
                        resolve({
                          duration: Number(
                            animation.effect!.getTiming().duration,
                          ),
                          opacity: String(frames.at(-1)?.opacity),
                        });
                      } else requestAnimationFrame(watch);
                    };
                    watch();
                  }),
              )
            : null;
        if (side === 'left') {
          await close().focus();
          await close()
            .press('Enter')
            .catch((error: Error) => {
              if (!error.message.includes('has been closed')) throw error;
            });
        } else {
          await close()
            .click()
            .catch((error: Error) => {
              if (
                !preview.isClosed() ||
                !error.message.includes('has been closed')
              )
                throw error;
            });
        }
        await expect.poll(async () => (await state()).split).toBeNull();
        await expect.poll(() => preview.isClosed()).toBe(true);
        if (closingEffect)
          expect(await closingEffect).toEqual({ duration: 180, opacity: '0' });
        expect(await closeMessages.jsonValue()).toEqual({
          reduced: [side === 'right'],
          animations: side === 'left' ? [180] : [],
        });
        await closeMessages.dispose();
        expect((await state()).tabs).toHaveLength(1);
        expect((await state()).canReopen).toBe(false);
        await expect(source.getByLabel('Draft')).toHaveValue('Keep my draft');
        if (side === 'left') preview = await open();
      }
      await chrome.evaluate(() => window.drift.find({ type: 'close' }));
      preview = await open();
      await preview.getByLabel('Draft').focus();
      await app.evaluate(({ webContents }, url) => {
        const page = webContents
          .getAllWebContents()
          .find((page) => page.getURL() === url)!;
        page.focus();
        page.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      }, origin + '/two');
      await expect.poll(() => preview.isClosed()).toBe(true);
      expect((await state()).split).toBeNull();
      if (!privateWindow) {
        const existingPages = app.windows();
        await source.getByText('Broken page').click({ modifiers: ['Control'] });
        await expect
          .poll(() =>
            app.windows().some((page) => !existingPages.includes(page)),
          )
          .toBe(true);
        const broken = app
          .windows()
          .find((page) => !existingPages.includes(page))!;
        const dismiss = broken.locator('[data-drift-preview-close]');
        await expect(dismiss).toBeVisible();
        await dismiss.click().catch((error: Error) => {
          if (!error.message.includes('has been closed')) throw error;
        });
        await expect.poll(() => broken.isClosed()).toBe(true);
        expect((await state()).split).toBeNull();
      }
      await source.getByText('Third page').click({ button: 'middle' });
      await expect.poll(async () => (await state()).tabs.length).toBe(2);
      expect((await state()).split).toBeNull();
      await chrome.evaluate(
        (id) => window.drift.tab({ type: 'split', id }),
        sourceId,
      );
      expect((await state()).split?.preview).not.toBe(true);
      await chrome
        .getByRole('button', { name: 'Close split view', exact: true })
        .click();
      expect((await state()).tabs).toHaveLength(2);
      expect((await state()).split).toBeNull();
      await chrome.evaluate(
        (id) => window.drift.tab({ type: 'select', id }),
        sourceId,
      );
      preview = await open();
      await preview.getByLabel('Draft').focus();
      await expect.poll(async () => (await state()).activeTabId).toBe(sourceId);
      await app.close();
      if (!privateWindow) {
        const saved = JSON.parse(
          await readFile(`${profile}/session.json`, 'utf8'),
        ).session;
        expect(saved.tabs).toHaveLength(2);
        expect(saved.activeTabId).toBe(sourceId);
        expect(
          saved.tabs.every(
            (tab: { url: string }) => tab.url !== origin + '/two',
          ),
        ).toBe(true);
      }
      app = await launch();
      chrome = await chromeWindow(app);
      expect((await state()).tabs).toHaveLength(privateWindow ? 1 : 2);
      expect((await state()).split).toBeNull();
      await expect(
        chrome.getByRole('button', { name: 'Close preview', exact: true }),
      ).toHaveCount(0);
      if (!privateWindow) {
        await expect
          .poll(() =>
            app.windows().some((page) => page.url() === origin + '/one'),
          )
          .toBe(true);
        const restored = app
          .windows()
          .find((page) => page.url() === origin + '/one')!;
        const otherId = (await state()).tabs.find(
          (tab) => tab.id !== sourceId,
        )!.id;
        const peek = async () => {
          await restored
            .getByText('Second page')
            .click({ modifiers: ['Control'] });
          await expect
            .poll(() =>
              app.windows().some((page) => page.url() === origin + '/two'),
            )
            .toBe(true);
          return app.windows().find((page) => page.url() === origin + '/two')!;
        };
        preview = await peek();
        await chrome.evaluate(
          (id) => window.drift.tab({ type: 'select', id }),
          otherId,
        );
        await expect.poll(() => preview.isClosed()).toBe(true);
        expect((await state()).split).toBeNull();
        expect((await state()).tabs).toHaveLength(2);
        await chrome.evaluate(
          (id) => window.drift.tab({ type: 'select', id }),
          sourceId,
        );
        preview = await peek();
        await app.evaluate(({ webContents }, url) => {
          const page = webContents
            .getAllWebContents()
            .find((page) => page.getURL() === url)!;
          page.focus();
          page.sendInputEvent({
            type: 'keyDown',
            keyCode: 'W',
            modifiers: ['control'],
          });
        }, origin + '/two');
        await expect.poll(() => preview.isClosed()).toBe(true);
        expect((await state()).canReopen).toBe(false);
        preview = await peek();
        await chrome.evaluate(
          (id) => window.drift.tab({ type: 'close', id }),
          sourceId,
        );
        await expect.poll(() => preview.isClosed()).toBe(true);
        expect((await state()).split).toBeNull();
        expect((await state()).tabs.map((tab) => tab.id)).toEqual([otherId]);
      }
    } finally {
      await app.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
