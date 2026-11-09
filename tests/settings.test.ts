import { expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  searchTemplate,
  shortcutKey,
  themeCSS,
} from '../src/shared/settings';
it('validates preferences, search templates, and unique normalized shortcuts', () => {
  expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  const legacy = { ...DEFAULT_SETTINGS } as Partial<typeof DEFAULT_SETTINGS>;
  delete legacy.glassEffect;
  expect(parseSettings(legacy).glassEffect).toBe(true);
  delete legacy.lockCollapsed;
  expect(parseSettings(legacy).lockCollapsed).toBe(
    DEFAULT_SETTINGS.lockCollapsed,
  );
  delete legacy.autoHideTopBar;
  expect(parseSettings(legacy).autoHideTopBar).toBe(true);
  delete legacy.toolbarLayout;
  expect(parseSettings(legacy).toolbarLayout).toBe(
    DEFAULT_SETTINGS.toolbarLayout,
  );
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
  const black = themeCSS(
    { ...DEFAULT_SETTINGS, theme: 'black', glassEffect: false },
    false,
    true,
  );
  expect(black).toContain('--glass:#1f1f21');
  for (const token of ['--chrome-bg', '--backdrop', '--panel'])
    expect(black).toContain(`${token}:#000000`);
  expect(black).toContain('--wallpaper-image:none');
  const blackGlass = themeCSS(
    { ...DEFAULT_SETTINGS, theme: 'black' },
    false,
    true,
  );
  expect(blackGlass).toContain('--chrome-bg:#000000d9');
  expect(blackGlass).toContain('--glass-blur:24px');
  expect(black).toContain('color-scheme:dark');
  expect(parseSettings({ ...DEFAULT_SETTINGS, theme: 'black' }).theme).toBe(
    'black',
  );
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
it('names shortcut keys by the physical key when Shift changes the character', () => {
  expect(shortcutKey({ key: '!', code: 'Digit1' })).toBe('1');
  expect(shortcutKey({ key: '+', code: 'Equal' })).toBe('=');
  expect(shortcutKey({ key: '_', code: 'Minus' })).toBe('-');
  expect(shortcutKey({ key: '<', code: 'Comma' })).toBe(',');
  expect(shortcutKey({ key: 't', code: 'KeyT' })).toBe('T');
  // Letters follow the keyboard layout, not the physical position.
  expect(shortcutKey({ key: 'a', code: 'KeyQ' })).toBe('A');
  expect(shortcutKey({ key: 'Tab', code: 'Tab' })).toBe('Tab');
  expect(shortcutKey({ key: 'F12', code: 'F12' })).toBe('F12');
});
