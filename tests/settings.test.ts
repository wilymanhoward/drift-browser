import { expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  searchTemplate,
  themeCSS,
} from '../src/shared/settings';
it('validates preferences, search templates, and unique normalized shortcuts', () => {
  expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  const legacy = { ...DEFAULT_SETTINGS } as Partial<typeof DEFAULT_SETTINGS>;
  delete legacy.glassEffect;
  expect(parseSettings(legacy).glassEffect).toBe(true);
  delete legacy.lockCollapsed;
  expect(parseSettings(legacy).lockCollapsed).toBe(false);
  delete legacy.autoHideTopBar;
  expect(parseSettings(legacy).autoHideTopBar).toBe(true);
  delete legacy.toolbarLayout;
  expect(parseSettings(legacy).toolbarLayout).toBe('sidebar');
  expect(() =>
    parseSettings({ ...DEFAULT_SETTINGS, toolbarLayout: 'bottom' as 'top' }),
  ).toThrow();
  delete legacy.maxAwakeTabs;
  expect(parseSettings(legacy).maxAwakeTabs).toBe(6);
  expect(() =>
    parseSettings({ ...DEFAULT_SETTINGS, maxAwakeTabs: 0 }),
  ).toThrow();
  expect(() =>
    parseSettings({ ...DEFAULT_SETTINGS, glassEffect: 'yes' }),
  ).toThrow();
  expect(
    searchTemplate({ ...DEFAULT_SETTINGS, searchEngine: 'brave' }),
  ).toContain('search.brave.com');
  for (const accent of ['#466a55', '#007aff'])
    expect(parseSettings({ ...DEFAULT_SETTINGS, accent }).accent).toBe(
      '#5856d6',
    );
  expect(themeCSS(DEFAULT_SETTINGS, false)).toContain('--accent-text:#ffffff');
  expect(themeCSS(DEFAULT_SETTINGS, true)).toContain('--text:#f5f5f7');
  expect(themeCSS({ ...DEFAULT_SETTINGS, accent: '#999999' }, false)).toContain(
    '--accent-text:#000000',
  );
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
