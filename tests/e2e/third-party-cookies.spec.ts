import { _electron as electron, expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromeWindow } from './helpers';

test('third-party cookies are kept per site, so trackers cannot follow you', async () => {
  // One "tracker" (localhost) embedded in two unrelated sites (127.0.0.1 and site.localhost)
  // Each frame request records which cookies it carried.
  const sent: Record<string, string[]> = {};
  let visit = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    res.setHeader('Content-Type', 'text/html');
    if (url.pathname === '/frame') {
      (sent[url.searchParams.get('from')!] ??= []).push(
        req.headers.cookie ?? '',
      );
      res.setHeader(
        'Set-Cookie',
        `t=${++visit}; SameSite=None; Secure; Path=/`,
      );
      res.end('frame');
    } else if (url.pathname === '/first') {
      (sent.first ??= []).push(req.headers.cookie ?? '');
      res.setHeader('Set-Cookie', 'f=1; SameSite=None; Secure; Path=/');
      res.end('<title>Tracker</title>first party');
    } else {
      const port = (server.address() as AddressInfo).port;
      res.end(
        `<title>Site</title><iframe src="http://localhost:${port}/frame?from=${url.searchParams.get('from')}"></iframe>`,
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const port = (server.address() as AddressInfo).port;
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
    const open = async (url: string, from: string, count: number) => {
      await chrome.evaluate((target) => window.drift.navigate(target), url);
      await expect.poll(() => sent[from]?.length ?? 0).toBe(count);
    };
    // Visiting the tracker directly sets a first-party cookie.
    await open(`http://localhost:${port}/first`, 'first', 1);
    await open(`http://127.0.0.1:${port}/page?from=a`, 'a', 1);
    await open(`http://127.0.0.1:${port}/page?from=a`, 'a', 2);
    await open(`http://site.localhost:${port}/page?from=b`, 'b', 1);
    await open(`http://localhost:${port}/first`, 'first', 2);
    // Embedded, the tracker never sees its first-party cookie.
    expect(sent.a[0]).toBe('');
    // On the same site, the embed keeps its own cookie (embeds keep working)…
    expect(sent.a[1]).toBe('t=1');
    // …but on another site it starts empty, so it cannot link the two visits.
    expect(sent.b[0]).toBe('');
    // And its embedded cookie never reaches it as a first party.
    expect(sent.first[1]).toBe('f=1');
  } finally {
    await app.close();
    server.close();
  }
});
