import { expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  chromiumBookmarks,
  chromiumPreferences,
  firefoxPreferences,
  detectBrowserSources,
  publicImportSource,
  readBrowserImport,
} from '../src/main/browser-import';
import { parseBrowserImport } from '../src/shared/browser-import';

it('imports only compatible preferences and never executes prefs.js', () => {
  expect(
    chromiumPreferences({
      browser: { theme: { color_scheme2: 2 } },
      session: { restore_on_startup: 1 },
      default_search_provider_data: {
        template_url_data: {
          url: '{google:baseURL}search?q={searchTerms}&{google:RLZ}',
        },
      },
    }),
  ).toEqual({ theme: 'dark', startup: 'restore', searchEngine: 'google' });
  expect(
    chromiumPreferences({
      default_search_provider_data: {
        template_url_data: {
          url: 'https://www.bing.com/search?q={searchTerms}',
        },
      },
    }),
  ).toEqual({
    searchEngine: 'custom',
    customSearch: 'https://www.bing.com/search?q={query}',
  });
  expect(
    chromiumPreferences({
      browser: { theme: { color_scheme2: 99 } },
      session: { restore_on_startup: 4 },
      default_search_provider_data: { url: 'javascript:alert(1)' },
    }),
  ).toEqual({});
  expect(
    firefoxPreferences(
      'user_pref("browser.startup.page", 3);\nuser_pref("extensions.activeThemeID", "firefox-compact-dark@mozilla.org");\nuser_pref("ui.systemUsesDarkTheme", (()=>{throw new Error("executed")})());',
    ),
  ).toEqual({ startup: 'restore', theme: 'dark' });
});
it('keeps bookmark folders, rejects non-web URLs and bounds titles', () => {
  const items = chromiumBookmarks({
    roots: {
      bookmark_bar: {
        type: 'folder',
        name: 'Bookmarks bar',
        children: [
          {
            type: 'folder',
            name: 'Work',
            children: [
              {
                type: 'url',
                name: 'x'.repeat(2000),
                url: 'https://example.com',
                date_added: '13300000000000000',
              },
              { type: 'url', name: 'Script', url: 'javascript:alert(1)' },
            ],
          },
        ],
      },
    },
  });
  expect(items).toHaveLength(1);
  expect(items[0].url).toBe('https://example.com/');
  expect(items[0].folder).toBe('Bookmarks bar / Work');
  expect(items[0].title).toHaveLength(1024);
  expect(items[0].createdAt).toBeGreaterThan(0);
  const untitled = chromiumBookmarks({
    roots: {
      bar: {
        type: 'folder',
        children: [
          {
            type: 'url',
            name: '',
            url: 'https://example.com/' + 'x'.repeat(2000),
          },
        ],
      },
    },
  });
  expect(untitled[0].title).toHaveLength(1024);
});
it('rejects arbitrary file paths, empty requests and extension IDs outside the selected profile', () => {
  const valid = {
    id: 'a'.repeat(24),
    bookmarks: true,
    preferences: false,
    extensions: [],
  };
  expect(parseBrowserImport(valid)).toEqual(valid);
  for (const input of [
    { ...valid, path: 'C:/private' },
    { ...valid, id: '../source' },
    { ...valid, bookmarks: false },
    { ...valid, extensions: ['bad'] },
    { ...valid, extensions: ['b'.repeat(32), 'b'.repeat(32)] },
  ])
    expect(() => parseBrowserImport(input)).toThrow();
});
it('detects Chromium and Mozilla profiles and reads bookmarks without writing source data', async () => {
  await mkdir('test-results', { recursive: true });
  const root = await mkdtemp(path.resolve('test-results/import-unit-'));
  const roots = {
    local: path.join(root, 'Local'),
    roaming: path.join(root, 'Roaming'),
  };
  const chrome = path.join(roots.local, 'Google/Chrome/User Data');
  const firefox = path.join(roots.roaming, 'Mozilla/Firefox');
  await mkdir(path.join(chrome, 'Default'), { recursive: true });
  await writeFile(
    path.join(chrome, 'Local State'),
    JSON.stringify({
      profile: { info_cache: { Default: { name: 'Personal' } } },
    }),
  );
  await writeFile(
    path.join(chrome, 'Default/Preferences'),
    JSON.stringify({ browser: { theme: { color_scheme2: 1 } } }),
  );
  const profile = path.join(firefox, 'Profiles/test.default');
  await mkdir(profile, { recursive: true });
  await writeFile(
    path.join(firefox, 'profiles.ini'),
    '[Profile0]\nName=Firefox test\nIsRelative=1\nPath=Profiles/test.default\n[Profile1]\nName=Escaped\nIsRelative=1\nPath=../../../../\n',
  );
  await writeFile(
    path.join(profile, 'prefs.js'),
    'user_pref("browser.startup.page", 3);',
  );
  const db = new DatabaseSync(path.join(profile, 'places.sqlite'));
  db.exec(`CREATE TABLE moz_places(id INTEGER PRIMARY KEY,url TEXT);CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY,parent INTEGER,type INTEGER,title TEXT,dateAdded INTEGER,fk INTEGER);
    INSERT INTO moz_places VALUES(1,'https://mozilla.org'),(2,'javascript:alert(1)');
    INSERT INTO moz_bookmarks VALUES(1,0,2,'Bookmarks menu',1700000000000000,NULL),(2,1,1,'Mozilla',1700000000000000,1),(3,1,1,'Unsafe',1700000000000000,2);`);
  db.close();
  const before = await readFile(path.join(profile, 'places.sqlite'));
  const sources = await detectBrowserSources(roots);
  expect(sources.map((source) => source.profile)).toEqual([
    'Personal',
    'Firefox test',
  ]);
  expect(publicImportSource(sources[0])).not.toHaveProperty('directory');
  const result = await readBrowserImport(roots, {
    id: sources[1].id,
    bookmarks: true,
    preferences: true,
    extensions: [],
  });
  expect(result.bookmarks.map((bookmark) => bookmark.url)).toEqual([
    'https://mozilla.org/',
  ]);
  expect(result.bookmarks[0].folder).toBe('Bookmarks menu');
  expect(result.preferences).toEqual({ startup: 'restore' });
  expect(await readFile(path.join(profile, 'places.sqlite'))).toEqual(before);
  await expect(
    readBrowserImport(roots, {
      id: sources[0].id,
      bookmarks: false,
      preferences: false,
      extensions: ['b'.repeat(32)],
    }),
  ).rejects.toThrow();
});
it('lists localized extensions and limits import to Chrome Web Store packages', async () => {
  const root = await mkdtemp(path.resolve('test-results/import-extensions-'));
  const roots = {
    local: path.join(root, 'Local'),
    roaming: path.join(root, 'Roaming'),
  };
  const folder = path.join(
    roots.local,
    'Microsoft/Edge/User Data/Default/Extensions',
    'a'.repeat(32),
    '2.0_0',
  );
  await mkdir(path.join(folder, '_locales/en'), { recursive: true });
  await writeFile(
    path.join(folder, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: '__MSG_name__',
      version: '2.0',
      default_locale: 'en',
      permissions: ['tabs'],
      update_url: 'https://clients2.google.com/service/update2/crx',
    }),
  );
  await writeFile(
    path.join(folder, '_locales/en/messages.json'),
    JSON.stringify({ name: { message: 'Imported extension' } }),
  );
  const sources = await detectBrowserSources(roots);
  expect(sources).toHaveLength(1);
  expect(sources[0].extensions[0]).toMatchObject({
    name: 'Imported extension',
    compatible: true,
    permissions: ['tabs'],
  });
  const result = await readBrowserImport(roots, {
    id: sources[0].id,
    bookmarks: false,
    preferences: false,
    extensions: ['a'.repeat(32)],
  });
  expect(result.extensions).toHaveLength(1);
});
