// Compares Drift's RAM with Brave/Chrome on the same 20 sites.
// Usage: npm run build && node scripts/measure-tabs.mjs
import { _electron as electron } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SITES = [
  'wikipedia.org', 'github.com', 'youtube.com', 'reddit.com',
  'news.ycombinator.com', 'bbc.com', 'amazon.com', 'stackoverflow.com',
  'x.com', 'nytimes.com', 'cnn.com', 'twitch.tv', 'imdb.com', 'weather.com',
  'espn.com', 'medium.com', 'bing.com', 'duckduckgo.com', 'google.com/maps',
  'theverge.com',
].map((s) => `https://${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BUILD = `electron ${JSON.parse(execFileSync(process.execPath, ['-p', "JSON.stringify(require('electron/package.json').version)"], { encoding: 'utf8' }))}`;
const MB = (bytes) => Math.round(bytes / 1048576);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const root = path.resolve('test-results', `memory-${Date.now()}`);
await mkdir(root, { recursive: true });
const tmp = await mkdtemp(path.join(os.tmpdir(), 'drift-mem-'));

// One method for every browser: the root process plus all its descendants,
// and anything whose command line names the temp profile.
function osProcesses(rootPid, profile) {
  const out = execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,PrivatePageCount,WorkingSetSize | ConvertTo-Json -Compress',
  ], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const all = JSON.parse(out);
  const keep = new Set(
    all.filter((p) => p.ProcessId === rootPid || p.CommandLine?.includes(profile)).map((p) => p.ProcessId),
  );
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of all)
      if (!keep.has(p.ProcessId) && keep.has(p.ParentProcessId)) {
        keep.add(p.ProcessId);
        grew = true;
      }
  }
  const procs = all.filter((p) => keep.has(p.ProcessId));
  return {
    processCount: procs.length,
    privateMB: MB(procs.reduce((n, p) => n + Number(p.PrivatePageCount), 0)),
    workingSetMB: MB(procs.reduce((n, p) => n + Number(p.WorkingSetSize), 0)),
    gpuPrivateMB: MB(
      procs
        .filter((p) => p.CommandLine?.includes('--type=gpu-process'))
        .reduce((n, p) => n + Number(p.PrivatePageCount), 0),
    ),
    pids: procs.map((p) => p.ProcessId),
  };
}

async function driftSample(app, chrome, profile, label) {
  const state = await chrome.evaluate(() => window.drift.getState());
  const detail = await app.evaluate(({ app, webContents }) => {
    const byPid = new Map();
    for (const wc of webContents.getAllWebContents()) {
      const pid = wc.getOSProcessId();
      if (!byPid.has(pid)) byPid.set(pid, []);
      byPid.get(pid).push({ type: wc.getType(), url: wc.getURL() });
    }
    const m = process.memoryUsage();
    return {
      main: {
        rssMB: Math.round(m.rss / 1048576),
        heapUsedMB: Math.round(m.heapUsed / 1048576),
        heapTotalMB: Math.round(m.heapTotal / 1048576),
        externalMB: Math.round(m.external / 1048576),
        arrayBuffersMB: Math.round(m.arrayBuffers / 1048576),
      },
      processes: app.getAppMetrics().map((p) => ({
        pid: p.pid,
        type: p.type,
        serviceName: p.serviceName,
        privateMB: Math.round((p.memory.privateBytes ?? 0) / 1024),
        workingSetMB: Math.round(p.memory.workingSetSize / 1024),
        webContents: byPid.get(p.pid) ?? [],
      })),
    };
  });
  detail.processes.sort((a, b) => b.privateMB - a.privateMB);
  const sample = {
    browser: 'Drift',
    scenario: label,
    tabs: state.tabs.length,
    awakeTabs: state.tabs.filter((t) => !t.unloaded).length,
    sleepingTabs: state.tabs.filter((t) => t.unloaded).length,
    ...osProcesses(app.process().pid, profile),
    appMetricsPrivateMB: detail.processes.reduce((n, p) => n + p.privateMB, 0),
    ...detail,
  };
  console.log(label, sample.processCount, 'procs', sample.privateMB, 'MB private');
  return sample;
}

async function runDrift(scenario, run) {
  const profile = path.join(tmp, `drift-${scenario}-${run}`);
  const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  const samples = [];
  try {
    let chrome;
    for (let i = 0; i < 200 && !chrome; i++) {
      chrome = app.windows().find((p) => p.url().includes('/renderer/index.html'));
      if (!chrome) await sleep(50);
    }
    if (!chrome) throw new Error('Chrome did not load');
    await chrome.waitForFunction(() => typeof window.drift?.getState === 'function');
    await chrome.waitForFunction(async () => !(await window.drift.getState()).loading);
    if (scenario === 'idle') {
      await sleep(20000);
      samples.push(await driftSample(app, chrome, profile, 'idle, 1 new tab'));
      return samples;
    }
    for (const [i, url] of SITES.entries()) {
      if (i > 0) await chrome.evaluate(() => window.drift.action('new-tab'));
      await chrome.evaluate((u) => window.drift.navigate(u), url);
      await sleep(5000);
    }
    await sleep(60000);
    samples.push(await driftSample(app, chrome, profile, '20 sites'));
    // Hover a background tab row; fall back to the IPC the row sends if the
    // sidebar is collapsed and the row is not hoverable.
    const state = await chrome.evaluate(() => window.drift.getState());
    const target = state.tabs.find((t) => t.id !== state.activeTabId);
    const row = chrome.locator(`.tab-row[data-tab-id="${target.id}"]`);
    let hovered = 'mouse';
    try {
      await row.hover({ timeout: 3000 });
    } catch {
      hovered = 'ipc';
      await chrome.evaluate((id) => window.drift.tabCard({ id, top: 120, edge: 240 }), target.id);
    }
    await sleep(3000);
    const s = await driftSample(app, chrome, profile, '20 sites + hover card');
    s.hoverMethod = hovered;
    samples.push(s);
    return samples;
  } finally {
    await app.close();
  }
}

function findExe(rel) {
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA];
  return bases.filter(Boolean).map((b) => path.join(b, rel)).find(existsSync);
}

async function runExternal(name, exe) {
  const profile = path.join(tmp, `${name.toLowerCase()}-profile`);
  const child = spawn(
    exe,
    [`--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...SITES],
    { stdio: 'ignore' },
  );
  await sleep(160000);
  const sample = { browser: name, scenario: '20 sites (args)', tabs: SITES.length, awakeTabs: null, ...osProcesses(child.pid, profile) };
  console.log(name, sample.processCount, 'procs', sample.privateMB, 'MB private, gpu', sample.gpuPrivateMB);
  // Only processes from our temp profile; never the user's own windows.
  for (const pid of sample.pids) {
    try { process.kill(pid); } catch { /* already gone */ }
  }
  return sample;
}

// --diagnose: one 20-site Drift run with glass on, one with glass off.
// Attributes renderer PIDs to tabs and iframes and tracks whether slept
// tabs' processes exit.
async function diagnose(glass, run = 1) {
  const profile = path.join(tmp, `drift-diag-${glass ? 'glass' : 'solid'}-${run}`);
  const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  try {
    let chrome;
    for (let i = 0; i < 200 && !chrome; i++) {
      chrome = app.windows().find((p) => p.url().includes('/renderer/index.html'));
      if (!chrome) await sleep(50);
    }
    if (!chrome) throw new Error('Chrome did not load');
    await chrome.waitForFunction(() => typeof window.drift?.getState === 'function');
    await chrome.waitForFunction(async () => !(await window.drift.getState()).loading);
    if (!glass)
      await chrome.evaluate(async () => {
        const s = await window.drift.getState();
        await window.drift.settings({ ...s.settings, glassEffect: false });
      });
    // Every 500ms remember each webContents' PID; when one disappears (a tab
    // slept or closed), check 10s later whether its PID still runs.
    await app.evaluate(({ app, webContents }) => {
      const live = new Map();
      const closed = [];
      globalThis.__memTrack = { closed };
      setInterval(() => {
        const all = webContents.getAllWebContents().filter((wc) => !wc.isDestroyed());
        const ids = new Set(all.map((wc) => wc.id));
        for (const wc of all)
          live.set(wc.id, { url: wc.getURL(), type: wc.getType(), pid: wc.getOSProcessId() });
        for (const [id, v] of live)
          if (!ids.has(id)) {
            closed.push({ ...v, closedAt: Date.now() });
            live.delete(id);
          }
        const now = Date.now();
        for (const c of closed)
          if (c.alive10s === undefined && now - c.closedAt >= 10000) {
            c.alive10s = app.getAppMetrics().some((m) => m.pid === c.pid);
            c.reusedByLive = all.some((wc) => wc.getOSProcessId() === c.pid);
          }
      }, 500);
    });
    const uiSample = async () => {
      const page = await chrome.evaluate(() => {
        const big = (n) => n > 100 * 1024;
        const imgs = [...document.querySelectorAll('img')].filter((i) => i.src.startsWith('data:'));
        const bgs = [...document.querySelectorAll('[style]')].map((e) => e.style.backgroundImage.length);
        return {
          usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
          totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
          domNodes: document.getElementsByTagName('*').length,
          dataImgs: imgs.length,
          dataImgsOver100KB: imgs.filter((i) => big(i.src.length)).length,
          dataImgsTotalKB: Math.round(imgs.reduce((n, i) => n + i.src.length, 0) / 1024),
          inlineBgOver100KB: bgs.filter(big).length,
          inlineBgTotalKB: Math.round(bgs.reduce((n, l) => n + l, 0) / 1024),
        };
      });
      const rendererPrivateMB = await app.evaluate(({ app, BrowserWindow }) => {
        const pid = BrowserWindow.getAllWindows()[0].webContents.getOSProcessId();
        const m = app.getAppMetrics().find((p) => p.pid === pid);
        return Math.round((m?.memory.privateBytes ?? 0) / 1024);
      });
      return { ...page, rendererPrivateMB };
    };
    const uiBefore = await uiSample();
    let overlaysOpened = 0;
    for (const [i, url] of SITES.entries()) {
      if (i > 0) {
        // The new-tab action opens the command overlay in the chrome page.
        await chrome.evaluate(() => window.drift.action('new-tab'));
        overlaysOpened++;
      }
      await chrome.evaluate((u) => window.drift.navigate(u), url);
      await sleep(5000);
    }
    await sleep(60000);
    const uiAfter = await uiSample();
    const state = await chrome.evaluate(() => window.drift.getState());
    const detail = await app.evaluate(({ app, webContents }) => {
      const owner = new Map();
      const add = (pid, entry) => {
        if (!owner.has(pid)) owner.set(pid, []);
        owner.get(pid).push(entry);
      };
      for (const wc of webContents.getAllWebContents()) {
        if (wc.isDestroyed()) continue;
        add(wc.getOSProcessId(), { kind: 'webContents', type: wc.getType(), url: wc.getURL(), crashed: wc.isCrashed() });
        for (const f of wc.mainFrame?.framesInSubtree ?? [])
          if (f !== wc.mainFrame && f.osProcessId !== wc.getOSProcessId())
            add(f.osProcessId, { kind: 'iframe', url: f.url, tab: wc.getURL() });
      }
      return {
        closed: globalThis.__memTrack.closed,
        processes: app.getAppMetrics().map((p) => ({
          pid: p.pid,
          type: p.type,
          name: p.name,
          serviceName: p.serviceName,
          sandboxed: p.sandboxed,
          privateMB: Math.round((p.memory.privateBytes ?? 0) / 1024),
          owners: owner.get(p.pid) ?? [],
        })),
      };
    });
    const sleptPids = new Set(detail.closed.map((c) => c.pid));
    const unattributed = detail.processes
      .filter((p) => p.type === 'Tab' && !p.owners.length)
      .map((p) => ({ ...p, wasSleptTabPid: sleptPids.has(p.pid) }));
    const totals = osProcesses(app.process().pid, profile);
    const embeds = detail.processes.flatMap((p) =>
      p.owners.filter((o) => o.kind === 'iframe' && o.url.includes('youtube.com/embed')).map((o) => ({ pid: p.pid, privateMB: p.privateMB, ...o })),
    );
    // Wake a slept tab and check it loads without an error.
    const slept = state.tabs.find((t) => t.unloaded);
    let wake = null;
    if (slept) {
      await chrome.evaluate((id) => window.drift.tab({ type: 'select', id }), slept.id);
      await sleep(10000);
      const t = (await chrome.evaluate(() => window.drift.getState())).tabs.find((x) => x.id === slept.id);
      wake = { url: slept.url, unloaded: t?.unloaded, loading: t?.loading, error: t?.error, title: t?.title };
    }
    const result = {
      browser: 'Drift',
      build: BUILD,
      run,
      scenario: `diagnose, glass ${glass ? 'on' : 'off'}`,
      youtubeEmbeds: embeds,
      wake,
      tabs: state.tabs.length,
      awakeTabs: state.tabs.filter((t) => !t.unloaded).length,
      ...totals,
      gpuAppMetricsMB: detail.processes.filter((p) => p.type === 'GPU').reduce((n, p) => n + p.privateMB, 0),
      overlaysOpened,
      uiBefore,
      uiAfter,
      unattributed,
      sleptTabs: detail.closed,
      processes: detail.processes.sort((a, b) => b.privateMB - a.privateMB),
    };
    console.log(result.scenario, totals.privateMB, 'MB private, gpu', result.gpuAppMetricsMB, 'unattributed', unattributed.length);
    return result;
  } finally {
    await app.close();
  }
}

const results = [];
// --after: two glass-on diagnose runs, saved as memory-compare-after.json.
const after = process.argv.includes('--after');
const diagnosing = after || process.argv.includes('--diagnose');
if (after) {
  results.push(await diagnose(true, 1), await diagnose(true, 2));
} else if (diagnosing) {
  results.push(await diagnose(true), await diagnose(false));
} else {
  for (const run of [1, 2]) {
    for (const scenario of ['idle', 'sites']) {
      for (const s of await runDrift(scenario, run)) results.push({ run, ...s });
    }
  }
}
for (const [name, rel] of [
  ['Brave', 'BraveSoftware/Brave-Browser/Application/brave.exe'],
  ['Chrome', 'Google/Chrome/Application/chrome.exe'],
]) {
  const exe = findExe(rel);
  if (exe) results.push({ run: 1, ...(await runExternal(name, exe)) });
  else console.log(`${name} not found`);
}

const report = {
  measuredAt: new Date().toISOString(),
  platform: `${process.platform} ${os.release()}`,
  totalRAMGB: Math.round(os.totalmem() / 2 ** 30),
  method:
    'Win32_Process PrivatePageCount and WorkingSetSize summed over the browser root process, its descendants and anything naming the temp profile. Working sets double-count shared pages. Drift per-process detail from app.getAppMetrics() joined to webContents by OS pid.',
  sites: SITES,
  results,
};
const file = path.join(root, 'results.json');
await writeFile(file, JSON.stringify(report, null, 2));
await mkdir('docs', { recursive: true });
const out = after ? 'memory-compare-after.json' : diagnosing ? 'memory-diagnose.json' : 'memory-compare.json';
await copyFile(file, path.join('docs', out));
console.log(`Results: ${file}`);
