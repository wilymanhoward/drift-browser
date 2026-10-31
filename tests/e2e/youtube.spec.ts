import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromeWindow } from './helpers';

test('YouTube removes ad instructions and exits a blank ad without seeking content', async () => {
  const profile = test.info().outputPath('profile');
  const engine = ElectronBlocker.parse('youtube.com##.fixture-ad');
  engine.updateResources(
    JSON.stringify({
      scriptlets: [
        {
          name: 'fixture.js',
          aliases: [],
          body: 'function fixture(){}',
          dependencies: [],
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
  const evaluate = (script: string) =>
    app.evaluate(({ BrowserWindow }, script) => {
      const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
        (view) => view.getVisible(),
      ) as Electron.WebContentsView;
      return view.webContents.executeJavaScript(script);
    }, script);
  try {
    const chrome = await chromeWindow(app);
    const response = {
      adPlacements: [{ id: 'ad' }],
      adSlots: [{ id: 'slot' }],
      no_ads: [{ id: 'renamed-slot' }],
      playerAds: [{ id: 'video-ad' }],
      adBreakHeartbeatParams: 'wait-20-seconds',
      streamingData: { formats: [{ url: 'https://media.example/content' }] },
      playabilityStatus: { status: 'OK' },
    };
    await app.context().route('https://www.youtube.com/**', (route) => {
      if (new URL(route.request().url()).pathname === '/youtubei/v1/player')
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      return route.fulfill({
        contentType: 'text/html',
        headers: {
          'Content-Security-Policy':
            "script-src 'nonce-fixture'; connect-src 'self'; require-trusted-types-for 'script'",
        },
        body: `<html><head><script nonce="fixture">
        window.ytInitialPlayerResponse=${JSON.stringify(response)};
        window.initial=JSON.stringify(window.ytInitialPlayerResponse);
        window.parsed=JSON.parse(${JSON.stringify(JSON.stringify(response))});
        window.ordinary=JSON.parse('{"adSlots":[1],"items":[2]}');
        window.loaded=Promise.all([
          fetch('/youtubei/v1/player').then(r=>r.json()).then(r=>window.fetched=r),
          new Promise(resolve=>{const xhr=new XMLHttpRequest();xhr.open('GET','/youtubei/v1/player');xhr.responseType='json';xhr.onload=()=>{window.xhrPlayer=xhr.response;resolve()};xhr.send()})
        ]);
        window.skips=0;window.finished=false;
      </script></head><body><div id="movie_player" class="html5-video-player"><video></video></div>
      <script nonce="fixture">
        const player=document.getElementById('movie_player');
        const skip=document.createElement('button');skip.className='ytp-skip-ad-button';skip.textContent='Skip ad';
        skip.onclick=()=>{window.skips++;window.finished=true;clearTimeout(window.adWait);player.classList.remove('ad-showing')};player.append(skip);
        window.initialAdPending=!!window.ytInitialPlayerResponse.adBreakHeartbeatParams;
        Object.defineProperty(document.querySelector('video'),'currentTime',{get(){return 7},set(){throw new Error('Must never seek the main video')}});
        window.startAd=()=>{window.finished=false;window.adWait=setTimeout(()=>{window.finished=true},20000);player.classList.add('ad-showing')};
      </script></body></html>`,
      });
    });
    await chrome.evaluate(() =>
      window.drift.navigate('https://www.youtube.com/watch?v=fixture'),
    );
    await expect
      .poll(() => evaluate('!!window.fetched && !!window.xhrPlayer'))
      .toBe(true);
    const initial = JSON.parse((await evaluate('window.initial')) as string);
    expect(initial.adPlacements).toBeUndefined();
    expect(initial.streamingData.formats[0].url).toBe(
      'https://media.example/content',
    );
    for (const source of [
      'window.parsed',
      'window.fetched',
      'window.xhrPlayer',
    ]) {
      const player = (await evaluate(source)) as typeof response;
      expect(player.adPlacements).toBeUndefined();
      expect(player.playerAds).toBeUndefined();
      expect(player.adSlots).toBeUndefined();
      expect(player.no_ads).toBeUndefined();
      expect(player.adBreakHeartbeatParams).toBeUndefined();
      expect(player.streamingData.formats[0].url).toBe(
        'https://media.example/content',
      );
      expect(player.playabilityStatus.status).toBe('OK');
    }
    expect(await evaluate('window.ordinary')).toEqual({
      adSlots: [1],
      items: [2],
    });
    expect(await evaluate('window.skips')).toBe(0);
    expect(await evaluate('window.initialAdPending')).toBe(false);
    await evaluate('window.startAd()');
    await expect
      .poll(() => evaluate('window.finished'), { timeout: 2000 })
      .toBe(true);
    expect(await evaluate('window.skips')).toBe(1);
    expect(await evaluate("document.querySelector('video').currentTime")).toBe(
      7,
    );
    await evaluate(
      `document.getElementById('movie_player').classList.add('playing-mode')`,
    );
    expect(await evaluate('window.skips')).toBe(1);
    await chrome.evaluate(() =>
      window.drift.privacy({ type: 'site', enabled: false }),
    );
    await expect.poll(() => evaluate('!!window.fetched')).toBe(true);
    expect(
      ((await evaluate('window.fetched')) as typeof response).adSlots,
    ).toEqual(response.adSlots);
    expect(await evaluate('window.initialAdPending')).toBe(true);
    await evaluate('window.startAd()');
    expect(await evaluate('window.skips')).toBe(0);
    expect(await evaluate('window.finished')).toBe(false);
  } finally {
    await app.close();
  }
});
