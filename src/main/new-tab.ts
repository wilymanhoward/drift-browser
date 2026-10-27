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
export function newTabHTML(
  bookmarks: Bookmark[],
  settings = DEFAULT_SETTINGS,
): string {
  const favorites = bookmarks
    .slice(0, 6)
    .map(
      (item) =>
        `<a href="${escapeHTML(item.url)}">${escapeHTML(item.title)}</a>`,
    )
    .join('');
  return `<!doctype html><html lang="en" data-search="${escapeHTML(searchTemplate(settings))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New tab</title><link rel="stylesheet" href="/newtab.css"><script defer src="/newtab.js"></script></head><body><main><p class="date" id="date"></p><h1><time id="clock" aria-label="Current time"></time></h1><form id="search"><label class="sr-only" for="query">Search or enter an address</label><input id="query" placeholder="Search or enter an address" autocomplete="off" spellcheck="false"><button type="submit">Go</button></form><p role="alert" id="error"></p><nav aria-label="Favorite sites">${favorites || '<p>Bookmark a page to keep it here.</p>'}</nav><p class="signature">Drift</p></main></body></html>`;
}
export async function newTabResponse(
  url: string,
  bookmarks: Bookmark[],
  settings: Settings = DEFAULT_SETTINGS,
  dark = false,
): Promise<Response> {
  const parsed = new URL(url);
  const headers = {
    'Content-Security-Policy':
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; base-uri 'none'; form-action https: http:; object-src 'none'; frame-ancestors 'none'",
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
        ? '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Settings</title><link rel="stylesheet" href="/newtab.css"></head><body><main><h1>Settings</h1><p>Your preferences are open in the browser panel.</p><p class="signature">Drift</p></main></body></html>'
        : newTabHTML(bookmarks, settings),
      {
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  if (parsed.pathname === '/newtab.js' || parsed.pathname === '/newtab.css') {
    try {
      return new Response(
        (await readFile(
          path.join(__dirname, '../internal', parsed.pathname.slice(1)),
          'utf8',
        )) +
          (parsed.pathname.endsWith('.css')
            ? themeCSS(settings, dark) +
              (settings.wallpaper
                ? `body{background-image:url("${settings.wallpaper}");background-size:cover;background-position:center}main{background:color-mix(in srgb,var(--surface) 92%,transparent);}`
                : '')
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
