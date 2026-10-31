import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Bookmark } from '../shared/browser';
import { DEFAULT_SETTINGS, searchTemplate, themeCSS } from '../shared/settings';
import type { Settings } from '../shared/settings';
function escapeHTML(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}
// Drawn inline because the page's CSP allows no image or font requests
// beyond its own assets.
const GEAR =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const SEARCH =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ARROW =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export function newTabHTML(
  bookmarks: Bookmark[],
  settings = DEFAULT_SETTINGS,
): string {
  const tiles = bookmarks
    .slice(0, 8)
    .map((item, index) => {
      const letter = ([...item.title.trim()][0] || '•').toUpperCase();
      return `<a class="tile" href="${escapeHTML(item.url)}"><span class="tile-icon c${index % 6}" aria-hidden="true">${escapeHTML(letter)}</span><span class="tile-name">${escapeHTML(item.title)}</span></a>`;
    })
    .join('');
  const favorites = `${tiles}<a class="tile add" href="drift://newtab/?add-site"><span class="tile-icon" aria-hidden="true">+</span><span class="tile-name">Add site</span></a>`;
  // Zen's pairing: a grotesque for the words, an italic serif for the accent.
  return `<!doctype html><html lang="en" data-glass="${settings.glassEffect}" data-wallpaper="${settings.wallpaper !== ''}" data-search="${escapeHTML(searchTemplate(settings))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New tab</title><link rel="stylesheet" href="/newtab.css"><script defer src="/newtab.js"></script></head><body><a class="gear" href="drift://newtab/?settings" aria-label="Settings" title="Settings">${GEAR}</a><main><h1 class="greeting">Where to <em>next?</em></h1><form id="search" role="search"><label class="sr-only" for="query">Search or enter an address</label>${SEARCH}<input id="query" placeholder="Search or enter address" autocomplete="off" spellcheck="false"><button type="submit" aria-label="Go" title="Go">${ARROW}</button></form><p role="alert" id="error"></p><section class="favorites" aria-labelledby="favorites-title"><h2 class="sr-only" id="favorites-title">Favourites</h2><nav aria-label="Favourite sites">${favorites}</nav></section></main></body></html>`;
}
export async function newTabResponse(
  url: string,
  bookmarks: Bookmark[],
  settings: Settings = DEFAULT_SETTINGS,
  dark = false,
  nativeGlass = false,
): Promise<Response> {
  const parsed = new URL(url);
  const headers = {
    'Content-Security-Policy':
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; font-src 'self'; base-uri 'none'; form-action https: http:; object-src 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store',
  };
  if (
    parsed.protocol !== 'drift:' ||
    !['newtab', 'settings'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    return new Response('Not found', { status: 404 });
  if (parsed.pathname === '/')
    return new Response(
      parsed.hostname === 'settings'
        ? '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Settings</title><link rel="stylesheet" href="/newtab.css"></head><body><main><h1>Settings</h1><p>Your preferences are open in the browser panel.</p></main></body></html>'
        : newTabHTML(bookmarks, settings),
      {
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  const font = {
    '/display.woff2': 'display.woff2',
    '/serif.woff': 'serif.woff',
  }[parsed.pathname as string];
  if (font) {
    try {
      return new Response(
        await readFile(path.join(__dirname, '../internal', font)),
        {
          headers: {
            ...headers,
            'Content-Type': font.endsWith('.woff2')
              ? 'font/woff2'
              : 'font/woff',
          },
        },
      );
    } catch {
      return new Response('Asset unavailable', { status: 500 });
    }
  }
  if (parsed.pathname === '/newtab.js' || parsed.pathname === '/newtab.css') {
    try {
      return new Response(
        (await readFile(
          path.join(__dirname, '../internal', parsed.pathname.slice(1)),
          'utf8',
        )) +
          (parsed.pathname.endsWith('.css')
            ? themeCSS(settings, dark, nativeGlass)
            : ''),
        {
          headers: {
            ...headers,
            'Content-Type': parsed.pathname.endsWith('.js')
              ? 'text/javascript; charset=utf-8'
              : 'text/css; charset=utf-8',
          },
        },
      );
    } catch {
      return new Response('Asset unavailable', { status: 500 });
    }
  }
  return new Response('Not found', { status: 404 });
}
