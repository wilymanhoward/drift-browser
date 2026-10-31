import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Bookmark } from '../shared/browser';
import type {
  BrowserImportSource,
  BrowserImportRequest,
  ImportedPreferences,
  BrowserImportExtension,
} from '../shared/browser-import';
import { isWebURL } from '../shared/navigation';

export interface ImportRoots {
  local: string;
  roaming: string;
}
type ImportedBookmark = Omit<Bookmark, 'id'>;
interface Source extends BrowserImportSource {
  directory: string;
  kind: 'chromium' | 'firefox';
}
const catalog = [
  ['Google Chrome', 'local', 'Google/Chrome/User Data', 'chromium'],
  ['Microsoft Edge', 'local', 'Microsoft/Edge/User Data', 'chromium'],
  ['Brave', 'local', 'BraveSoftware/Brave-Browser/User Data', 'chromium'],
  ['Vivaldi', 'local', 'Vivaldi/User Data', 'chromium'],
  ['Chromium', 'local', 'Chromium/User Data', 'chromium'],
  ['Opera', 'roaming', 'Opera Software/Opera Stable', 'chromium'],
  ['Opera GX', 'roaming', 'Opera Software/Opera GX Stable', 'chromium'],
  ['Firefox', 'roaming', 'Mozilla/Firefox', 'firefox'],
  ['Zen', 'roaming', 'zen', 'firefox'],
] as const;
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const get = (v: unknown, ...keys: string[]): unknown =>
  keys.reduce((value, key) => object(value)[key], v);
const label = (v: unknown, fallback: string, max = 160) =>
  typeof v === 'string' && v.trim()
    ? v.trim().slice(0, max)
    : fallback.slice(0, max);
const contained = (root: string, file: string) => {
  const relative = path.relative(root, file);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};
async function sourceFile(directory: string, name: string) {
  const file = await realpath(path.join(directory, name));
  if (!contained(directory, file))
    throw new Error('Profile file is outside its browser folder.');
  return file;
}
async function textFile(
  directory: string,
  name: string,
  max = 20 * 1024 * 1024,
) {
  const file = await sourceFile(directory, name);
  const info = await stat(file);
  if (!info.isFile() || info.size > max)
    throw new Error('Profile file is too large or unavailable.');
  return readFile(file, 'utf8');
}
async function exists(directory: string, name: string) {
  try {
    return (await stat(await sourceFile(directory, name))).isFile();
  } catch {
    return false;
  }
}
async function jsonFile(directory: string, name: string) {
  return JSON.parse(await textFile(directory, name)) as unknown;
}
async function profileExtensions(
  directory: string,
): Promise<BrowserImportExtension[]> {
  let root: string;
  try {
    root = await realpath(path.join(directory, 'Extensions'));
    if (!contained(directory, root)) return [];
  } catch {
    return [];
  }
  const result: BrowserImportExtension[] = [];
  for (const entry of (
    await readdir(root, { withFileTypes: true }).catch(() => [])
  ).slice(0, 200)) {
    if (!entry.isDirectory() || !/^[a-p]{32}$/.test(entry.name)) continue;
    try {
      const versions = (
        await readdir(path.join(root, entry.name), { withFileTypes: true })
      )
        .filter(
          (v) => v.isDirectory() && /^\d+(?:\.\d+){0,3}(?:_\d+)?$/.test(v.name),
        )
        .sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { numeric: true }),
        );
      if (!versions[0]) continue;
      const folder = await realpath(
        path.join(root, entry.name, versions[0].name),
      );
      if (!contained(root, folder)) continue;
      const manifest = object(await jsonFile(folder, 'manifest.json'));
      let name = label(manifest.name, entry.name);
      const message = /^__MSG_(\w+)__$/.exec(name);
      const locale =
        typeof manifest.default_locale === 'string' &&
        /^[\w@-]{2,32}$/.test(manifest.default_locale)
          ? manifest.default_locale
          : 'en';
      if (message)
        try {
          name = label(
            get(
              await jsonFile(folder, `_locales/${locale}/messages.json`),
              message[1],
              'message',
            ),
            entry.name,
          );
        } catch {
          name = entry.name;
        }
      const permissions = [
        manifest.permissions,
        manifest.host_permissions,
      ].flatMap((value) =>
        Array.isArray(value)
          ? value
              .filter(
                (p): p is string => typeof p === 'string' && p.length <= 500,
              )
              .slice(0, 100)
          : [],
      );
      const compatible =
        (manifest.manifest_version === 2 || manifest.manifest_version === 3) &&
        !manifest.theme &&
        typeof manifest.update_url === 'string' &&
        /^https:\/\/clients2\.google\.com\/service\/update2\/crx\/?$/.test(
          manifest.update_url,
        );
      result.push({
        id: entry.name,
        name,
        version: label(manifest.version, 'Unknown'),
        permissions,
        compatible,
      });
    } catch {
      /* A removed or incomplete extension is not an import source. */
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function detectBrowserSources(
  roots: ImportRoots,
): Promise<Source[]> {
  const found: Source[] = [];
  for (const [browser, base, relative, kind] of catalog) {
    let root: string;
    try {
      root = await realpath(path.join(roots[base], relative));
    } catch {
      continue;
    }
    let profiles: { directory: string; name: string }[] = [];
    if (kind === 'chromium') {
      let names: unknown = {};
      try {
        names = get(
          await jsonFile(root, 'Local State'),
          'profile',
          'info_cache',
        );
      } catch {
        /* Folder names still identify profiles. */
      }
      profiles = [{ directory: root, name: 'Default' }];
      const entries = await readdir(root, { withFileTypes: true }).catch(
        () => [],
      );
      for (const entry of entries.slice(0, 200))
        if (entry.isDirectory() && /^(Default|Profile \d+)$/.test(entry.name))
          profiles.push({
            directory: path.join(root, entry.name),
            name: label(get(names, entry.name, 'name'), entry.name),
          });
    } else {
      let ini: string;
      try {
        ini = await textFile(root, 'profiles.ini', 1024 * 1024);
      } catch {
        continue;
      }
      for (const block of ini.split(/\r?\n(?=\[)/).slice(0, 100)) {
        if (!/^\[Profile\d+\]/.test(block.trim())) continue;
        const fields = Object.fromEntries(
          block
            .split(/\r?\n/)
            .filter((line) => line.includes('='))
            .map((line) => {
              const i = line.indexOf('=');
              return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
            }),
        );
        if (!fields.Path) continue;
        profiles.push({
          directory:
            fields.IsRelative === '0'
              ? path.resolve(fields.Path)
              : path.resolve(root, fields.Path),
          name: label(fields.Name, 'Default'),
        });
      }
    }
    for (const profile of profiles) {
      let directory: string;
      try {
        directory = await realpath(profile.directory);
      } catch {
        continue;
      }
      if (!contained(root, directory)) continue;
      const bookmarks = await exists(
        directory,
        kind === 'chromium' ? 'Bookmarks' : 'places.sqlite',
      );
      const preferences = await exists(
        directory,
        kind === 'chromium' ? 'Preferences' : 'prefs.js',
      );
      const extensions =
        kind === 'chromium' ? await profileExtensions(directory) : [];
      if (!bookmarks && !preferences && !extensions.length) continue;
      const id = createHash('sha256')
        .update(browser + '\0' + directory)
        .digest('hex')
        .slice(0, 24);
      if (found.some((source) => source.id === id)) continue;
      found.push({
        id,
        browser,
        profile: profile.name,
        directory,
        kind,
        bookmarks,
        preferences,
        extensions,
      });
    }
  }
  return found;
}
export function publicImportSource({
  id,
  browser,
  profile,
  bookmarks,
  preferences,
  extensions,
}: Source): BrowserImportSource {
  return { id, browser, profile, bookmarks, preferences, extensions };
}

export function chromiumBookmarks(value: unknown): ImportedBookmark[] {
  const result: ImportedBookmark[] = [];
  let visited = 0;
  const walk = (value: unknown, folders: string[], depth: number) => {
    if (++visited > 50000 || depth > 32) return;
    const node = object(value);
    if (node.type === 'url') {
      if (
        typeof node.url !== 'string' ||
        node.url.length > 8192 ||
        !isWebURL(node.url)
      )
        return;
      const added = Number(node.date_added) / 1000 - 11644473600000;
      result.push({
        url: new URL(node.url).href,
        title: label(node.name, node.url, 1024),
        folder: (folders.join(' / ') || 'Bookmarks').slice(0, 80),
        createdAt: Number.isFinite(added) && added >= 0 ? added : Date.now(),
      });
    } else if (Array.isArray(node.children))
      for (const child of node.children)
        walk(child, [...folders, label(node.name, 'Bookmarks')], depth + 1);
  };
  for (const root of Object.values(object(get(value, 'roots'))))
    walk(root, [], 0);
  return result;
}
function searchPreference(value: unknown): ImportedPreferences {
  if (typeof value !== 'string' || value.length > 2048) return {};
  const template = value
    .replace('{google:baseURL}', 'https://www.google.com/')
    .replaceAll('{searchTerms}', '{query}');
  let url: URL;
  try {
    url = new URL(template.replaceAll('{query}', 'test'));
  } catch {
    return {};
  }
  if (url.protocol !== 'https:' || !template.includes('{query}')) return {};
  if (/(^|\.)google\.[a-z.]+$/.test(url.hostname))
    return { searchEngine: 'google' };
  const known: Record<string, 'duckduckgo' | 'brave' | 'startpage'> = {
    'duckduckgo.com': 'duckduckgo',
    'search.brave.com': 'brave',
    'www.startpage.com': 'startpage',
    'startpage.com': 'startpage',
  };
  if (Object.hasOwn(known, url.hostname))
    return { searchEngine: known[url.hostname] };
  if (/\{(?!query\})/.test(template)) return {};
  return { searchEngine: 'custom', customSearch: template };
}
export function chromiumPreferences(value: unknown): ImportedPreferences {
  const patch: ImportedPreferences = {};
  const theme =
    get(value, 'browser', 'theme', 'color_scheme2') ??
    get(value, 'browser', 'theme', 'color_scheme');
  if (theme === 0 || theme === 1 || theme === 2)
    patch.theme = (['system', 'light', 'dark'] as const)[theme];
  const startup = get(value, 'session', 'restore_on_startup');
  if (startup === 1) patch.startup = 'restore';
  if (startup === 5) patch.startup = 'new-tab';
  Object.assign(
    patch,
    searchPreference(
      get(value, 'default_search_provider_data', 'template_url_data', 'url') ??
        get(value, 'default_search_provider_data', 'url'),
    ),
  );
  return patch;
}
export function firefoxPreferences(text: string): ImportedPreferences {
  const prefs: Record<string, unknown> = {};
  const wanted = new Set([
    'browser.startup.page',
    'extensions.activeThemeID',
    'ui.systemUsesDarkTheme',
  ]);
  for (const match of text.matchAll(
    /^\s*user_pref\("([^"\\]+)",\s*(.+)\);\s*$/gm,
  ))
    if (wanted.has(match[1])) {
      try {
        prefs[match[1]] = JSON.parse(match[2]);
      } catch {
        /* Never execute preferences as JavaScript. */
      }
    }
  const patch: ImportedPreferences = {};
  if (prefs['browser.startup.page'] === 3) patch.startup = 'restore';
  if (
    prefs['browser.startup.page'] === 0 ||
    prefs['browser.startup.page'] === 1
  )
    patch.startup = 'new-tab';
  const themes: Record<string, 'system' | 'light' | 'dark'> = {
    'default-theme@mozilla.org': 'system',
    'firefox-compact-light@mozilla.org': 'light',
    'firefox-compact-dark@mozilla.org': 'dark',
  };
  const theme = prefs['extensions.activeThemeID'];
  if (typeof theme === 'string' && Object.hasOwn(themes, theme))
    patch.theme = themes[theme];
  else if (
    prefs['ui.systemUsesDarkTheme'] === 0 ||
    prefs['ui.systemUsesDarkTheme'] === 1
  )
    patch.theme = prefs['ui.systemUsesDarkTheme'] === 1 ? 'dark' : 'light';
  return patch;
}
async function firefoxBookmarks(
  directory: string,
): Promise<ImportedBookmark[]> {
  const file = await sourceFile(directory, 'places.sqlite');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true, timeout: 1000 });
  try {
    const rows = db
      .prepare(
        'SELECT b.id,b.parent,b.type,b.title,b.dateAdded,p.url FROM moz_bookmarks b LEFT JOIN moz_places p ON b.fk=p.id WHERE b.type IN (1,2) LIMIT 50000',
      )
      .all();
    const folders = new Map(
      rows.filter((row) => row.type === 2).map((row) => [row.id, row]),
    );
    return rows
      .filter(
        (row) =>
          row.type === 1 &&
          typeof row.url === 'string' &&
          row.url.length <= 8192 &&
          isWebURL(row.url),
      )
      .map((row) => {
        const names: string[] = [];
        const seen = new Set();
        let parent = row.parent;
        while (folders.has(parent) && !seen.has(parent) && names.length < 32) {
          seen.add(parent);
          const folder = folders.get(parent)!;
          if (folder.title) names.unshift(label(folder.title, 'Bookmarks'));
          parent = folder.parent;
        }
        const time = Number(row.dateAdded) / 1000;
        return {
          url: new URL(row.url as string).href,
          title: label(row.title, row.url as string, 1024),
          folder: (names.join(' / ') || 'Bookmarks').slice(0, 80),
          createdAt: Number.isFinite(time) && time >= 0 ? time : Date.now(),
        };
      });
  } finally {
    db.close();
  }
}
export async function readBrowserImport(
  roots: ImportRoots,
  request: BrowserImportRequest,
) {
  const source = (await detectBrowserSources(roots)).find(
    (source) => source.id === request.id,
  );
  if (!source)
    throw new Error(
      'That browser profile is no longer available. Refresh the list.',
    );
  const extensions = request.extensions.map((id) => {
    const extension = source.extensions.find(
      (extension) => extension.id === id && extension.compatible,
    );
    if (!extension)
      throw new Error(
        'A selected extension is no longer available or compatible. Refresh the list.',
      );
    return extension;
  });
  let bookmarks: ImportedBookmark[] = [];
  let preferences: ImportedPreferences = {};
  const warnings: string[] = [];
  if (request.bookmarks)
    try {
      bookmarks =
        source.kind === 'chromium'
          ? chromiumBookmarks(await jsonFile(source.directory, 'Bookmarks'))
          : await firefoxBookmarks(source.directory);
    } catch {
      warnings.push(
        'Bookmarks could not be read. Close the source browser and try again.',
      );
    }
  if (request.preferences)
    try {
      preferences =
        source.kind === 'chromium'
          ? chromiumPreferences(await jsonFile(source.directory, 'Preferences'))
          : firefoxPreferences(
              await textFile(source.directory, 'prefs.js', 5 * 1024 * 1024),
            );
      if (!Object.keys(preferences).length)
        warnings.push(
          'No compatible preferences were found; Drift preferences were kept.',
        );
    } catch {
      warnings.push(
        'Preferences could not be read; Drift preferences were kept.',
      );
    }
  return { bookmarks, preferences, warnings, extensions };
}
