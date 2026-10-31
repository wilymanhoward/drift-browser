import { test, expect, _electron as electron } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { chromeWindow } from './helpers';

test('detected browser profiles import bookmarks and preferences without replacing existing data', async () => {
  const root = test.info().outputPath('sources');
  const local = path.join(root, 'Local');
  const roaming = path.join(root, 'Roaming');
  const chrome = path.join(local, 'Google/Chrome/User Data');
  const firefox = path.join(roaming, 'Mozilla/Firefox');
  const ffProfile = path.join(firefox, 'Profiles/test.default');
  await mkdir(path.join(chrome, 'Default'), { recursive: true });
  await mkdir(ffProfile, { recursive: true });
  await writeFile(
    path.join(chrome, 'Local State'),
    JSON.stringify({ profile: { info_cache: { Default: { name: 'Work' } } } }),
  );
  const prefs = JSON.stringify({
    browser: { theme: { color_scheme2: 2 } },
    session: { restore_on_startup: 1 },
    default_search_provider_data: {
      template_url_data: { url: 'https://www.bing.com/search?q={searchTerms}' },
    },
  });
  const bookmarks = JSON.stringify({
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
                name: 'Imported',
                url: 'https://imported.example',
              },
              {
                type: 'url',
                name: 'Duplicate',
                url: 'https://existing.example/',
              },
            ],
          },
        ],
      },
    },
  });
  await writeFile(path.join(chrome, 'Default/Preferences'), prefs);
  await writeFile(path.join(chrome, 'Default/Bookmarks'), bookmarks);
  const extension = path.join(
    chrome,
    'Default/Extensions',
    'b'.repeat(32),
    '1.0_0',
  );
  await mkdir(extension, { recursive: true });
  await writeFile(
    path.join(extension, 'manifest.json'),
    JSON.stringify({
      name: 'Migration Helper',
      version: '1.0',
      manifest_version: 3,
      permissions: ['tabs'],
      update_url: 'https://clients2.google.com/service/update2/crx',
    }),
  );
  await writeFile(
    path.join(firefox, 'profiles.ini'),
    '[Profile0]\nName=Firefox work\nIsRelative=1\nPath=Profiles/test.default\n',
  );
  await writeFile(
    path.join(ffProfile, 'prefs.js'),
    'user_pref("extensions.activeThemeID", "firefox-compact-light@mozilla.org");',
  );
  const db = new DatabaseSync(path.join(ffProfile, 'places.sqlite'));
  db.exec(
    `CREATE TABLE moz_places(id INTEGER PRIMARY KEY,url TEXT);CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY,parent INTEGER,type INTEGER,title TEXT,dateAdded INTEGER,fk INTEGER);INSERT INTO moz_places VALUES(1,'https://mozilla.example/');INSERT INTO moz_bookmarks VALUES(1,0,2,'Mozilla bookmarks',1700000000000000,NULL),(2,1,1,'Mozilla',1700000000000000,1);`,
  );
  db.close();
  const sourceDB = await readFile(path.join(ffProfile, 'places.sqlite'));
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      LOCALAPPDATA: local,
      APPDATA: roaming,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  const launch = () =>
    electron.launch({
      ...(executablePath && { executablePath }),
      args: [
        ...(executablePath ? [] : ['.']),
        `--user-data-dir=${test.info().outputPath('profile')}`,
      ],
      env,
    });
  let app = await launch();
  try {
    let page = await chromeWindow(app);
    await page.evaluate(async () => {
      await window.drift.bookmark({
        type: 'save',
        url: 'https://existing.example/',
        title: 'Existing bookmark',
        folder: 'Keep',
      });
      const state = await window.drift.getState();
      await window.drift.settings({ ...state.settings, accent: '#123456' });
      await window.drift.action('show-settings');
    });
    await page
      .getByRole('button', { name: 'Import from browser', exact: true })
      .click();
    await expect(
      page.getByRole('option', { name: 'Google Chrome · Work', exact: true }),
    ).toBeAttached();
    await expect(
      page.getByRole('option', { name: 'Firefox · Firefox work', exact: true }),
    ).toBeAttached();
    await expect(
      page.getByRole('checkbox', { name: /Migration Helper/ }),
    ).not.toBeChecked();
    await page
      .getByText('Permissions for Migration Helper', { exact: true })
      .click();
    await expect(page.locator('.browser-import details')).toContainText('tabs');
    await page
      .getByRole('button', { name: 'Import selected data', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: '1 bookmarks added' }),
    ).toContainText('1 duplicates');
    const state = await page.evaluate(() => window.drift.getState());
    expect(state.settings).toMatchObject({
      theme: 'dark',
      startup: 'restore',
      searchEngine: 'custom',
      customSearch: 'https://www.bing.com/search?q={query}',
      accent: '#123456',
    });
    let library = await page.evaluate(() => window.drift.getLibrary());
    expect(library.bookmarks).toHaveLength(2);
    expect(
      library.bookmarks.find(
        (bookmark) => bookmark.url === 'https://existing.example/',
      ),
    ).toMatchObject({ title: 'Existing bookmark', folder: 'Keep' });
    expect(
      library.bookmarks.find(
        (bookmark) => bookmark.url === 'https://imported.example/',
      ),
    ).toMatchObject({ folder: 'Bookmarks bar / Work' });
    expect(
      (
        await new AxeBuilder({ page })
          .setLegacyMode(true)
          .include('.browser-import')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath('import-chrome-dark.png'),
    });
    await page
      .getByRole('button', { name: 'Import selected data', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: '0 bookmarks added' }),
    ).toContainText('2 duplicates');
    const sources = await page.evaluate(() => window.drift.detectBrowsers());
    const source = sources.find((source) => source.browser === 'Firefox')!;
    await page
      .getByLabel('Browser profile', { exact: true })
      .selectOption(source.id);
    await page
      .getByRole('button', { name: 'Import selected data', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.drift.getState())).settings.theme,
      )
      .toBe('light');
    library = await page.evaluate(() => window.drift.getLibrary());
    expect(library.bookmarks).toHaveLength(3);
    const failures = (
      await new AxeBuilder({ page })
        .setLegacyMode(true)
        .include('.browser-import')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
    ).violations;
    expect(failures).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath('import-settings.png'),
    });
    await app.close();
    app = await launch();
    page = await chromeWindow(app);
    expect(
      (await page.evaluate(() => window.drift.getLibrary())).bookmarks,
    ).toHaveLength(3);
    expect(
      (await page.evaluate(() => window.drift.getState())).settings,
    ).toMatchObject({
      theme: 'light',
      searchEngine: 'custom',
      accent: '#123456',
    });
    expect(
      await readFile(path.join(chrome, 'Default/Preferences'), 'utf8'),
    ).toBe(prefs);
    expect(await readFile(path.join(chrome, 'Default/Bookmarks'), 'utf8')).toBe(
      bookmarks,
    );
    expect(await readFile(path.join(ffProfile, 'places.sqlite'))).toEqual(
      sourceDB,
    );
  } finally {
    await app.close();
  }
});

test('browser import handles an empty scan and is unavailable in private windows', async () => {
  const root = test.info().outputPath('empty');
  await mkdir(path.join(root, 'Local'), { recursive: true });
  await mkdir(path.join(root, 'Roaming'), { recursive: true });
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      LOCALAPPDATA: path.join(root, 'Local'),
      APPDATA: path.join(root, 'Roaming'),
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.DRIFT_TEST_EXECUTABLE;
  const app = await electron.launch({
    ...(executablePath && { executablePath }),
    args: [
      ...(executablePath ? [] : ['.']),
      `--user-data-dir=${test.info().outputPath('profile')}`,
    ],
    env,
  });
  try {
    const page = await chromeWindow(app);
    await page.evaluate(() => window.drift.action('show-settings'));
    await page
      .getByRole('button', { name: 'Import from browser', exact: true })
      .click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'No supported browser profiles' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Import selected data', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Refresh browser list', exact: true })
      .click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'No supported browser profiles' }),
    ).toBeVisible();
    await page.evaluate(() => window.drift.action('private-window'));
    await expect
      .poll(
        () =>
          app
            .windows()
            .filter((window) => window.url().includes('/renderer/index.html'))
            .length,
      )
      .toBe(2);
    const privatePage = app
      .windows()
      .filter((window) => window.url().includes('/renderer/index.html'))
      .find((window) => window !== page)!;
    await privatePage.waitForFunction(
      () => typeof window.drift?.detectBrowsers === 'function',
    );
    expect(
      await privatePage.evaluate(() => window.drift.detectBrowsers()),
    ).toEqual([]);
    await expect(
      privatePage.evaluate(() =>
        window.drift.importBrowser({
          id: 'a'.repeat(24),
          bookmarks: true,
          preferences: false,
          extensions: [],
        }),
      ),
    ).rejects.toThrow('regular windows');
  } finally {
    await app.close();
  }
});
