import { describe, expect, it, vi, afterEach } from 'vitest';
import { isPageURL, NEW_TAB_URL, resolveInput } from '../src/shared/navigation';
import { fuzzyScore, searchEntries } from '../src/shared/search';
import {
  BrowserLibrary,
  parseBookmark,
  parseLibrary,
} from '../src/main/library';
import { newTabHTML, newTabResponse } from '../src/main/new-tab';

describe('command navigation', () => {
  it('bounds encoded addresses while retaining matches late in long titles', () => {
    expect(() => resolveInput('長'.repeat(1000))).toThrow();
    expect(
      fuzzyScore('needle', `${'x'.repeat(600)}needle`),
    ).toBeGreaterThanOrEqual(0);
  });
  it('uses HTTPS for domains and Google for search text', () => {
    expect(resolveInput('example.com/path')).toBe('https://example.com/path');
    expect(resolveInput('calm browser & tabs')).toBe(
      'https://www.google.com/search?q=calm%20browser%20%26%20tabs',
    );
    expect(resolveInput('http://localhost:3000/a')).toBe(
      'http://localhost:3000/a',
    );
    expect(resolveInput('drift://newtab')).toBe(NEW_TAB_URL);
    expect(isPageURL('drift://newtab/settings')).toBe(false);
  });
  it.each([
    'javascript:alert(1)',
    'file:///C:/secret',
    'data:text/html,test',
    'drift://settings',
    'https://user:pass@example.com',
    '',
    null,
    {},
  ])('rejects unsafe input %s', (input) => {
    expect(() => resolveInput(input)).toThrow();
  });
  it('ranks substring and subsequence matches and caps suggestions', () => {
    expect(fuzzyScore('ghub', 'GitHub')).toBeGreaterThanOrEqual(0);
    expect(fuzzyScore('xyz', 'GitHub')).toBe(-1);
    const entries = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      kind: 'tab' as const,
      title: `Page ${index}`,
      url: 'https://example.com',
    }));
    expect(searchEntries(entries, '')).toHaveLength(12);
    expect(searchEntries(entries, 'Page 12')[0].id).toBe('12');
  });
});
describe('library storage boundary', () => {
  afterEach(() => vi.useRealTimers());
  it('keeps unique visits, updates titles without counting a second visit, and groups bookmarks', () => {
    vi.useFakeTimers();
    const library = new BrowserLibrary(() => {});
    library.visit('https://example.com/', 'Example', true);
    library.visit('https://example.com/', 'Updated', false);
    expect(library.data.history).toMatchObject([
      { title: 'Updated', visits: 1 },
    ]);
    library.visit(NEW_TAB_URL, 'New tab', true);
    expect(library.data.history).toHaveLength(1);
    const command = parseBookmark({
      type: 'save',
      url: 'https://example.com/',
      title: ' Example ',
      folder: ' Work ',
    });
    library.bookmark(command);
    library.bookmark(command);
    expect(library.data.bookmarks).toHaveLength(1);
    expect(library.data.bookmarks[0].folder).toBe('Work');
    const id = library.data.bookmarks[0].id;
    library.bookmark(
      parseBookmark({
        type: 'save',
        id,
        url: 'https://example.com/updated',
        title: 'Moved',
        folder: 'Work',
      }),
    );
    expect(library.data.bookmarks).toHaveLength(1);
    expect(library.data.bookmarks[0]).toMatchObject({
      id,
      url: 'https://example.com/updated',
    });
    expect(parseLibrary(library.data)).not.toBeNull();
    library.clearHistory();
    expect(library.data.history).toHaveLength(0);
    library.flush();
  });
  it.each([
    {
      history: [],
      bookmarks: [
        {
          id: 'a',
          url: 'javascript:alert(1)',
          title: 'Bad',
          folder: 'Work',
          createdAt: 1,
        },
      ],
    },
    {
      history: [
        {
          url: 'https://example.com/',
          title: 'Example',
          lastVisited: Infinity,
          visits: 1,
        },
      ],
      bookmarks: [],
    },
    { history: [], bookmarks: null },
    null,
  ])('rejects damaged libraries', (value) => {
    expect(parseLibrary(value)).toBeNull();
  });
  it.each([
    { type: 'save', url: 'file:///C:/secret', title: 'Test', folder: '' },
    { type: 'save', url: NEW_TAB_URL, title: 'Test', folder: '' },
    { type: 'remove', id: '' },
    { type: 'remove', id: 'a', extra: true },
  ])('rejects malformed bookmark commands', (value) => {
    expect(() => parseBookmark(value)).toThrow();
  });
  it('escapes saved titles and restricts internal protocol routes', async () => {
    const html = newTabHTML([
      {
        id: 'a',
        url: 'https://example.com/?x="&y=1',
        title: '<script>alert(1)</script>',
        folder: 'Work',
        createdAt: 1,
      },
    ]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    const response = await newTabResponse(NEW_TAB_URL, []);
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "script-src 'self'",
    );
    expect((await newTabResponse('drift://newtab/secret', [])).status).toBe(
      404,
    );
    expect((await newTabResponse('drift://other/', [])).status).toBe(404);
  });
});
