import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ElectronApplication } from '@playwright/test';
import { chromeWindow } from './helpers';

const page = (app: ElectronApplication, script: string) =>
  app.evaluate(
    ({ BrowserWindow }, code) =>
      (
        BrowserWindow.getAllWindows()[0].contentView
          .children[0] as Electron.WebContentsView
      ).webContents.executeJavaScript(code),
    script,
  );

test('Shields inject scriptlets before page scripts and hide ads', async () => {
  const server = createServer((_req, res) => {
    // A strict CSP like YouTube's must not stop scriptlets.
    res.setHeader(
      'Content-Security-Policy',
      "script-src 'nonce-fixture'; require-trusted-types-for 'script'",
    );
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<html><head><script nonce="fixture">window.seen = window.driftMarker || 'late';</script></head><body><div class="ad-banner">Ad</div><div class="sponsor-box">Sponsored</div><p id="content">Video</p></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}/`;
  const profile = test.info().outputPath('profile');
  const engine = ElectronBlocker.parse(
    [
      'localhost##+js(drift-marker)',
      'localhost##+js(drift-second)',
      'localhost##.ad-banner',
      '##.sponsor-box',
    ].join('\n'),
    { enableCompression: true },
  );
  engine.updateResources(
    JSON.stringify({
      scriptlets: [
        // Both share a helper declared with `class`, like uBO's JSONPath.
        {
          name: 'drift-helper.fn',
          aliases: [],
          body: 'class DriftHelper {}',
          dependencies: [],
        },
        {
          name: 'drift-marker.js',
          aliases: [],
          body: 'function driftMarker() { window.driftMarker = "early"; }',
          dependencies: ['drift-helper.fn'],
        },
        {
          name: 'drift-second.js',
          aliases: [],
          body: 'function driftSecond() { window.driftSecond = new DriftHelper() instanceof DriftHelper; }',
          dependencies: ['drift-helper.fn'],
        },
      ],
      redirects: [],
    }),
    'fixture',
  );
  await mkdir(path.join(profile, 'filters'), { recursive: true });
  await writeFile(path.join(profile, 'filters/engine.bin'), engine.serialize());
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (item): item is [string, string] => item[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await chrome.evaluate((target) => window.drift.navigate(target), url);
    await expect.poll(() => page(app, 'window.seen')).toBe('early');
    expect(await page(app, 'window.driftSecond')).toBe(true);
    const hidden = `[...document.querySelectorAll('.ad-banner, .sponsor-box')].map((el) => getComputedStyle(el).display)`;
    await expect.poll(() => page(app, hidden)).toEqual(['none', 'none']);
    expect(await page(app, `getComputedStyle(content).display`)).toBe('block');
    await chrome.evaluate(() =>
      window.drift.privacy({ type: 'site', enabled: false }),
    );
    await expect.poll(() => page(app, 'window.seen')).toBe('late');
    expect(await page(app, hidden)).toEqual(['block', 'block']);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('an incomplete cached blocker is replaced by bundled player-safe scriptlets', async () => {
  const profile = test.info().outputPath('profile');
  await mkdir(path.join(profile, 'filters'), { recursive: true });
  await writeFile(
    path.join(profile, 'filters/engine.bin'),
    ElectronBlocker.parse('||www.youtube.com^').serialize(),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  const app = await electron.launch({
    ...(executablePath && { executablePath }),
    args: [...(executablePath ? [] : ['.']), `--user-data-dir=${profile}`],
    env,
  });
  try {
    const chrome = await chromeWindow(app);
    await app.context().route('https://www.youtube.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<html><head><script>
      window.ytInitialPlayerResponse={adPlacements:[{ad:1}],streamingData:{formats:[{url:'https://media.example/video'}]},playabilityStatus:{status:'OK'}};
      window.playerFixture=JSON.stringify(window.ytInitialPlayerResponse);
      </script></head><body>Player fixture</body></html>`,
      }),
    );
    await chrome.evaluate(() =>
      window.drift.navigate('https://www.youtube.com/watch?v=fixture'),
    );
    await expect.poll(() => page(app, '!!window.playerFixture')).toBe(true);
    const player = JSON.parse(
      (await page(app, 'window.playerFixture')) as string,
    );
    expect(player.adPlacements).toBeUndefined();
    expect(player.streamingData.formats[0].url).toBe(
      'https://media.example/video',
    );
    expect(player.playabilityStatus.status).toBe('OK');
    await app.evaluate(() => {
      globalThis.fetch = async () => {
        throw new Error('Offline fixture');
      };
    });
    await chrome.evaluate(() => window.drift.action('show-shields'));
    await chrome
      .getByRole('button', {
        name: 'Update filters and reload page',
        exact: true,
      })
      .click();
    await expect(chrome.getByRole('alert')).toContainText(
      'Existing rules remain active',
    );
    expect(await page(app, 'window.playerFixture')).toBeTruthy();
    const sources = JSON.parse(
      await readFile('assets/filters/full-sources.json', 'utf8'),
    ) as { url: string; body: string }[];
    const before = (await chrome.evaluate(() => window.drift.getShields()))
      .updatedAt;
    await app.evaluate((_electron, sources) => {
      globalThis.fetch = async (input) => {
        const source = sources.find((source) => source.url === String(input));
        if (!source) throw new Error('Unexpected filter URL');
        return new Response(source.body);
      };
    }, sources);
    await chrome
      .getByRole('button', {
        name: 'Update filters and reload page',
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await chrome.evaluate(() => window.drift.getShields())).updatedAt,
      )
      .toBeGreaterThan(before);
    await expect(
      chrome.getByRole('button', {
        name: 'Update filters and reload page',
        exact: true,
      }),
    ).toBeEnabled();
    await expect(chrome.getByRole('alert')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
