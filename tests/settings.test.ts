import { expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  searchTemplate,
  themeCSS,
} from '../src/shared/settings';
it('validates preferences, search templates, and unique normalized shortcuts', () => {
  expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  expect(
    searchTemplate({ ...DEFAULT_SETTINGS, searchEngine: 'brave' }),
  ).toContain('search.brave.com');
  expect(themeCSS(DEFAULT_SETTINGS, true)).toContain('--text:#edf1eb');
  expect(() =>
    parseSettings({ ...DEFAULT_SETTINGS, accent: 'red; background:url(x)' }),
  ).toThrow();
  expect(() =>
    parseSettings({ ...DEFAULT_SETTINGS, collapsedWidth: 999 }),
  ).toThrow();
  expect(() =>
    parseSettings({
      ...DEFAULT_SETTINGS,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, 'close-tab': 'Shift+Ctrl+T' },
    }),
  ).toThrow();
  expect(() =>
    parseSettings({
      ...DEFAULT_SETTINGS,
      wallpaper: 'https://example.com/tracker.png',
    }),
  ).toThrow();
});
