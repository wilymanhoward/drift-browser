import { _electron as electron, expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, statSync } from 'node:fs';
import { chromeWindow } from './helpers';

const SIZE = 48 * 1024 * 1024;
const PER_CONNECTION = 3 * 1024 * 1024; // bytes per second

test('downloads show in the toolbar with speed and use parallel connections', async () => {
  test.setTimeout(90000);
  const ranges: string[] = [];
  const body = Buffer.alloc(SIZE, 7);
  // Each connection is held to 3 MB/s, like a server that limits per connection.
  const server = createServer((req, res) => {
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
    ranges.push(req.headers.range ?? 'none');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Number(range[2]) : SIZE - 1;
    res.writeHead(range ? 206 : 200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="big.bin"',
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      ETag: '"big-1"',
      'Last-Modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${SIZE}` } : {}),
    });
    let at = start;
    const chunk = PER_CONNECTION / 20;
    const timer = setInterval(() => {
      if (res.destroyed) return clearInterval(timer);
      const next = Math.min(at + chunk, end + 1);
      res.write(body.subarray(at, next));
      at = next;
      if (at > end) {
        clearInterval(timer);
        res.end();
      }
    }, 50);
    req.on('close', () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/big.bin`;
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
  const target = test.info().outputPath('big.bin');
  try {
    const chrome = await chromeWindow(app);
    await expect(chrome.locator('.downloads-button')).toHaveCount(0);
    const started = Date.now();
    await app.evaluate(
      ({ webContents }, { url, target }) => {
        const tab = webContents
          .getAllWebContents()
          .find((page) => page.getURL().startsWith('drift://newtab'))!;
        tab.session.once('will-download', (_event, item) =>
          item.setSavePath(target),
        );
        tab.downloadURL(url);
      },
      { url, target },
    );
    const button = chrome.locator('.downloads-button');
    await expect(button).toHaveAttribute('aria-label', /1 in progress, \d+%/);
    // The auto-hidden top bar comes into view when the download starts.
    await expect(button).toBeVisible();
    await button.click();
    await expect(chrome.getByText(/MB\/s · \d+ s left/)).toBeVisible();
    await expect(
      chrome.getByRole('button', { name: 'Show in folder' }),
    ).toBeVisible({ timeout: 20000 });
    const seconds = (Date.now() - started) / 1000;
    expect(existsSync(target) && statSync(target).size).toBe(SIZE);
    console.log(
      `downloaded in ${seconds.toFixed(1)} s; requests: ${ranges.join(' | ')}`,
    );
    // One connection alone needs SIZE / PER_CONNECTION = 16 s.
    expect(ranges.filter((r) => r !== 'none').length).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(SIZE / PER_CONNECTION);
    await expect(button).toHaveAttribute('aria-label', 'Downloads');
  } finally {
    await app.close();
    server.close();
  }
});
