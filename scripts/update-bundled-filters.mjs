import { FiltersEngine } from '@ghostery/adblocker';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base =
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/';
const sources = [
  'easylist/easylist.txt',
  'easylist/easyprivacy.txt',
  'peter-lowe/serverlist.txt',
  'ublock-origin/filters.txt',
  'ublock-origin/quick-fixes.txt',
  'ublock-origin/badware.txt',
  'ublock-origin/privacy.txt',
  'ublock-origin/resource-abuse.txt',
  'ublock-origin/unbreak.txt',
  'ublock-origin/resources.json',
];
const bodies = await Promise.all(
  sources.map(async (source) => {
    const response = await fetch(base + source, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`Could not download ${source}: ${response.status}`);
    const body = await response.text();
    assert.ok(body.length > 1000 && !/^\s*</.test(body));
    return body;
  }),
);
const engine = FiltersEngine.parse(bodies.slice(0, -1).join('\n'), {
  enableCompression: true,
});
engine.updateResources(
  bodies.at(-1),
  createHash('sha256').update(bodies.at(-1)).digest('hex'),
);
assert.ok(engine.resources.scriptlets.length > 0);
assert.ok(
  engine.getCosmeticsFilters({
    url: 'https://www.youtube.com/',
    hostname: 'www.youtube.com',
    domain: 'youtube.com',
    getInjectionRules: true,
    getRulesFromHostname: true,
  }).scripts.length > 0,
);
const data = engine.serialize();
await writeFile(
  'assets/filters/full-sources.json',
  JSON.stringify(
    sources.map((source, index) => ({
      url: base + source,
      body: bodies[index],
    })),
    null,
    2,
  ) + '\n',
);
await writeFile('assets/filters/full-engine.bin', data);
await writeFile(
  'assets/filters/full-engine.json',
  JSON.stringify(
    {
      updatedAt: Date.now(),
      sha256: createHash('sha256').update(data).digest('hex'),
      sources: sources.map((source, index) => ({
        url: base + source,
        sha256: createHash('sha256').update(bodies[index]).digest('hex'),
      })),
    },
    null,
    2,
  ) + '\n',
);
const license = await fetch(
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/LICENSE',
);
assert.ok(license.ok);
await writeFile('assets/filters/UBLOCK-LICENSE.txt', await license.text());
console.log(
  `Bundled ${data.length} bytes; ${engine.resources.scriptlets.length} scriptlet resources.`,
);
