import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import { expect, it } from 'vitest';

const data = readFileSync('assets/filters/full-engine.bin');
const engine = FiltersEngine.deserialize(data);
it('ships matching network, cosmetic and scriptlet rules without a download', () => {
  const metadata = JSON.parse(
    readFileSync('assets/filters/full-engine.json', 'utf8'),
  );
  expect(createHash('sha256').update(data).digest('hex')).toBe(metadata.sha256);
  expect(engine.resources.scriptlets.length).toBeGreaterThan(0);
  expect(
    engine.getCosmeticsFilters({
      url: 'https://www.youtube.com/',
      hostname: 'www.youtube.com',
      domain: 'youtube.com',
      getInjectionRules: true,
      getRulesFromHostname: true,
    }).scripts.length,
  ).toBeGreaterThan(0);
});
it('blocks advertising requests while allowing ordinary YouTube player and media requests', () => {
  const match = (url: string, type: 'script' | 'xmlhttprequest' | 'media') =>
    engine.match(
      Request.fromRawDetails({
        url,
        type,
        sourceUrl: 'https://www.youtube.com/watch?v=fixture',
      }),
    );
  expect(match('https://td.doubleclick.net/ads.js', 'script').match).toBe(true);
  expect(
    match('https://www.youtube.com/youtubei/v1/player', 'xmlhttprequest').match,
  ).toBe(false);
  expect(
    match(
      'https://rr1---sn.example.googlevideo.com/videoplayback?itag=247&range=0-999',
      'media',
    ).match,
  ).toBe(false);
});
