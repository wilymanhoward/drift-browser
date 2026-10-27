import { _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const root = path.resolve('test-results', `performance-${Date.now()}`);
await mkdir(root, { recursive: true });
const samples = [];
for (let i = 0; i < 4; i++) {
  const profile = path.join(root, `profile-${i}`);
  if (i === 3) {
    await mkdir(profile, { recursive: true });
    await writeFile(
      path.join(profile, 'session.json'),
      JSON.stringify({
        session: {
          version: 1,
          tabs: Array.from({ length: 20 }, (_, n) => ({
            id: `bench-${n}`,
            url: 'drift://newtab/',
            title: 'New tab',
            muted: false,
          })),
          activeTabId: 'bench-0',
          sidebar: { pinned: false, width: 224 },
        },
      }),
    );
  }
  const start = performance.now();
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env,
  });
  try {
    let chrome;
    for (let attempt = 0; attempt < 100; attempt++) {
      chrome = app
        .windows()
        .find((p) => p.url().includes('/renderer/index.html'));
      if (
        chrome &&
        (await chrome.evaluate(
          () => typeof window.drift?.getState === 'function',
        ))
      )
        break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!chrome) throw new Error('Chrome did not load');
    await chrome.waitForFunction(
      async () => !(await window.drift.getState()).loading,
    );
    const startupMs = Math.round(performance.now() - start);
    await app.evaluate(({ app }) => app.getAppMetrics());
    await new Promise((r) => setTimeout(r, 10000));
    const metrics = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((m) => ({
        type: m.type,
        cpuPercent: m.cpu.percentCPUUsage,
        workingSetKB: m.memory.workingSetSize,
        privateKB: m.memory.privateBytes,
      })),
    );
    samples.push({
      scenario: i === 3 ? '20 restored tabs' : 'Fresh new tab',
      loadedTabs: await chrome.evaluate(() =>
        window.drift
          .getState()
          .then((s) => s.tabs.filter((t) => !t.unloaded).length),
      ),
      startupMs,
      workingSetMB: Math.round(
        metrics.reduce((n, m) => n + m.workingSetKB, 0) / 1024,
      ),
      privateMB: Math.round(
        metrics.reduce((n, m) => n + (m.privateKB ?? 0), 0) / 1024,
      ),
      cpuPercent: Number(
        metrics.reduce((n, m) => n + m.cpuPercent, 0).toFixed(2),
      ),
      processes: metrics,
    });
    console.log(JSON.stringify(samples.at(-1)));
  } finally {
    await app.close();
  }
}
const medianStartupMs = samples
  .slice(0, 3)
  .map((s) => s.startupMs)
  .sort((a, b) => a - b)[1];
const report = {
  measuredAt: new Date().toISOString(),
  platform: process.platform,
  architecture: process.arch,
  scenario:
    'Fresh profile, local new tab, 10-second idle; includes Electron GPU/network/renderers. Working sets may count shared pages more than once.',
  medianStartupMs,
  samples,
};
await writeFile(
  path.join(root, 'results.json'),
  JSON.stringify(report, null, 2),
);
console.log(`Results: ${path.join(root, 'results.json')}`);
