import { _electron as electron, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const root = path.resolve('test-results', `frost-${Date.now()}`);
await mkdir(root, { recursive: true });
const samples = [];
for (const glass of [false, true, false, true]) {
  const app = await electron.launch({
    args: [
      '.',
      `--user-data-dir=${path.join(root, `profile-${samples.length}`)}`,
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
    await chrome.evaluate(async (glassEffect) => {
      const s = await window.drift.getState();
      await window.drift.settings({
        ...s.settings,
        theme: 'dark',
        glassEffect,
      });
    }, glass);
    const surface = await app.evaluate(async ({ webContents }) => {
      const home = webContents
        .getAllWebContents()
        .find((w) => w.getURL() === 'drift://newtab/');
      if (!home) throw new Error('Missing home page');
      if (home.isLoading())
        await new Promise((resolve) => home.once('did-finish-load', resolve));
      return home.executeJavaScript(`({
        blur: getComputedStyle(document.querySelector('main')).backdropFilter,
        blurLayers: [...document.querySelectorAll('*')].filter(e => !['none','blur(0px)'].includes(getComputedStyle(e).backdropFilter)).length,
        animations: document.getAnimations().length,
        clock: document.querySelector('#clock').textContent
      })`);
    });
    assert.equal(surface.blur, glass ? 'blur(20px)' : 'none');
    assert.equal(surface.blurLayers, glass ? 1 : 0);
    assert.equal(surface.animations, 0);
    assert.ok(surface.clock);
    await app.evaluate(({ app }) => app.getAppMetrics());
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const metrics = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((m) => ({
        type: m.type,
        cpu: m.cpu.percentCPUUsage,
        privateKB: m.memory.privateBytes,
      })),
    );
    samples.push({
      glass,
      surface,
      privateMB: Math.round(
        metrics.reduce((n, m) => n + (m.privateKB ?? 0), 0) / 1024,
      ),
      cpuPercent: Number(metrics.reduce((n, m) => n + m.cpu, 0).toFixed(2)),
    });
    console.log(JSON.stringify(samples.at(-1)));
    if (glass) {
      const png = await app.evaluate(async ({ webContents }) => {
        const home = webContents
          .getAllWebContents()
          .find((w) => w.getURL() === 'drift://newtab/');
        return (await home.capturePage()).toPNG().toString('base64');
      });
      await writeFile(
        path.join(root, 'home-dark.png'),
        Buffer.from(png, 'base64'),
      );
    }
  } finally {
    await app.close();
  }
}
await writeFile(
  path.join(root, 'results.json'),
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      method:
        'Two alternating fresh profiles per mode, dark home, 10s idle. All Electron process private bytes and aggregate CPU; excludes GPU VRAM and OS compositor memory.',
      samples,
    },
    null,
    2,
  ),
);
console.log(`Results: ${root}`);
