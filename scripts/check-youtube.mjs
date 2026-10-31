import { _electron as electron, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.argv[2] ?? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
if (new URL(url).hostname !== 'www.youtube.com')
  throw new Error('Expected a www.youtube.com URL');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const root = path.resolve('test-results', `youtube-playback-${Date.now()}`);
await mkdir(root, { recursive: true });
const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
const app = await electron.launch({
  ...(executablePath && { executablePath }),
  args: [...(executablePath ? [] : ['.']), `--user-data-dir=${root}/profile`],
  env,
});
const samples = [];
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
  const start = performance.now();
  await chrome.evaluate((url) => {
    void window.drift.navigate(url);
  }, url);
  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const sample = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
        (view) => view.getVisible(),
      );
      if (!view?.webContents) throw new Error('No page view');
      return view.webContents.executeJavaScript(`(() => {
        const video = document.querySelector('video');
        return {title:document.title, state:document.readyState,
          playerStatus:window.ytInitialPlayerResponse?.playabilityStatus?.status,
          ad:!!document.querySelector('.html5-video-player.ad-showing'),
          playerSkipAvailable:typeof document.querySelector('#movie_player')?.skipAd === 'function',
          video: video ? {ready:video.readyState, time:video.currentTime, paused:video.paused,
            width:video.videoWidth, height:video.videoHeight,
            decodedFrames:video.getVideoPlaybackQuality().totalVideoFrames,
            droppedFrames:video.getVideoPlaybackQuality().droppedVideoFrames,
            error:video.error?.message ?? null} : null};
      })()`);
    });
    samples.push({
      elapsedMs: Math.round(performance.now() - start),
      ...sample,
    });
    console.log(JSON.stringify(samples.at(-1)));
    if (!sample.ad && sample.video?.time > 1 && sample.video.decodedFrames > 0)
      break;
  }
  const shields = await chrome.evaluate(() => window.drift.getShields());
  await writeFile(
    path.join(root, 'results.json'),
    JSON.stringify({ url, samples, shields }, null, 2),
  );
  const last = samples.at(-1);
  if (last?.ad || !last?.video?.decodedFrames || last.video.time <= 1)
    throw new Error('Content did not decode and advance within 60 seconds');
  console.log(
    `Playback passed with Shields enabled: ${shields.enabled}; ${shields.blocked} requests blocked. Results: ${root}`,
  );
} finally {
  await app.close();
}
