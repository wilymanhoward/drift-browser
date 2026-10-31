export const DEFAULT_SHORTCUTS: Record<string, string> = {
  'new-tab': 'Ctrl+T',
  'close-tab': 'Ctrl+W',
  'reopen-tab': 'Ctrl+Shift+T',
  'open-command': 'Ctrl+L',
  'next-tab': 'Ctrl+Tab',
  'previous-tab': 'Ctrl+Shift+Tab',
  'show-history': 'Ctrl+H',
  'show-bookmarks': 'Ctrl+Shift+B',
  'show-settings': 'Ctrl+,',
  'toggle-sidebar': 'Ctrl+S',
  compact: 'Ctrl+Alt+C',
  split: 'Ctrl+Shift+S',
  devtools: 'F12',
  'show-downloads': 'Ctrl+J',
  find: 'Ctrl+F',
  print: 'Ctrl+P',
  'zoom-in': 'Ctrl+=',
  'zoom-out': 'Ctrl+-',
  'zoom-reset': 'Ctrl+0',
  fullscreen: 'F11',
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [
      `workspace-${i + 1}`,
      `Ctrl+Alt+${i + 1}`,
    ]),
  ),
};
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  glassEffect: boolean;
  accent: string;
  sidebarPosition: 'left' | 'right';
  collapsedWidth: number;
  expandedWidth: number;
  density: 'compact' | 'comfortable';
  radius: number;
  contentInset: boolean;
  contentShadow: boolean;
  wallpaper: string;
  customCSS: string;
  startup: 'restore' | 'new-tab';
  searchEngine: 'google' | 'duckduckgo' | 'brave' | 'startpage' | 'custom';
  customSearch: string;
  hoverExpand: boolean;
  lockCollapsed: boolean;
  toolbarLayout: 'sidebar' | 'top';
  autoHideTopBar: boolean;
  unloadMinutes: number;
  maxAwakeTabs: number;
  shortcuts: Record<string, string>;
}
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  glassEffect: true,
  accent: '#5856d6',
  sidebarPosition: 'left',
  collapsedWidth: 44,
  expandedWidth: 208,
  density: 'comfortable',
  radius: 12,
  contentInset: true,
  contentShadow: true,
  wallpaper: '',
  customCSS: '',
  startup: 'restore',
  searchEngine: 'google',
  customSearch: 'https://www.google.com/search?q={query}',
  hoverExpand: true,
  lockCollapsed: false,
  toolbarLayout: 'sidebar',
  autoHideTopBar: true,
  unloadMinutes: 15,
  maxAwakeTabs: 6,
  shortcuts: DEFAULT_SHORTCUTS,
};
// Earlier default accents follow the default forward.
const LEGACY_ACCENTS = ['#466a55', '#007aff'];
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid settings');
  const v = {
    ...(value as Settings),
    accent: LEGACY_ACCENTS.includes((value as Settings).accent)
      ? DEFAULT_SETTINGS.accent
      : (value as Settings).accent,
    glassEffect:
      (value as Settings).glassEffect === undefined
        ? DEFAULT_SETTINGS.glassEffect
        : (value as Settings).glassEffect,
    toolbarLayout:
      (value as Settings).toolbarLayout === undefined
        ? DEFAULT_SETTINGS.toolbarLayout
        : (value as Settings).toolbarLayout,
    autoHideTopBar:
      (value as Settings).autoHideTopBar === undefined
        ? DEFAULT_SETTINGS.autoHideTopBar
        : (value as Settings).autoHideTopBar,
    lockCollapsed:
      (value as Settings).lockCollapsed === undefined
        ? DEFAULT_SETTINGS.lockCollapsed
        : (value as Settings).lockCollapsed,
    maxAwakeTabs:
      (value as Settings).maxAwakeTabs === undefined
        ? DEFAULT_SETTINGS.maxAwakeTabs
        : (value as Settings).maxAwakeTabs,
  };
  if (
    Object.keys(v).some((key) => !(key in DEFAULT_SETTINGS)) ||
    !['light', 'dark', 'system'].includes(v.theme) ||
    typeof v.glassEffect !== 'boolean' ||
    !/^#[\da-f]{6}$/i.test(v.accent) ||
    !['left', 'right'].includes(v.sidebarPosition) ||
    !Number.isInteger(v.collapsedWidth) ||
    v.collapsedWidth < 40 ||
    v.collapsedWidth > 80 ||
    !Number.isInteger(v.expandedWidth) ||
    v.expandedWidth < 208 ||
    v.expandedWidth > 360 ||
    !['compact', 'comfortable'].includes(v.density) ||
    !Number.isInteger(v.radius) ||
    v.radius < 0 ||
    v.radius > 20 ||
    typeof v.contentInset !== 'boolean' ||
    typeof v.contentShadow !== 'boolean' ||
    typeof v.wallpaper !== 'string' ||
    v.wallpaper.length > 4500000 ||
    (v.wallpaper !== '' &&
      !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(v.wallpaper)) ||
    typeof v.customCSS !== 'string' ||
    v.customCSS.length > 50000 ||
    !['restore', 'new-tab'].includes(v.startup) ||
    !['google', 'duckduckgo', 'brave', 'startpage', 'custom'].includes(
      v.searchEngine,
    ) ||
    typeof v.customSearch !== 'string' ||
    v.customSearch.length > 2048 ||
    !v.customSearch.includes('{query}') ||
    !/^https:\/\//.test(v.customSearch) ||
    typeof v.hoverExpand !== 'boolean' ||
    typeof v.lockCollapsed !== 'boolean' ||
    !['sidebar', 'top'].includes(v.toolbarLayout) ||
    typeof v.autoHideTopBar !== 'boolean' ||
    !Number.isInteger(v.unloadMinutes) ||
    v.unloadMinutes < 1 ||
    v.unloadMinutes > 1440 ||
    !Number.isInteger(v.maxAwakeTabs) ||
    v.maxAwakeTabs < 1 ||
    v.maxAwakeTabs > 50 ||
    !v.shortcuts ||
    typeof v.shortcuts !== 'object'
  )
    throw new Error('Invalid settings values');
  new URL(v.customSearch.replace('{query}', 'test'));
  const bindings = new Set<string>();
  const shortcuts: Record<string, string> = {};
  for (const key of Object.keys(DEFAULT_SHORTCUTS)) {
    const binding = v.shortcuts[key];
    if (
      typeof binding !== 'string' ||
      !/^(?:(?:Ctrl|Alt|Shift)\+)*(?:[A-Za-z0-9,=-]|Tab|F(?:[1-9]|1[0-2]))$/.test(
        binding,
      ) ||
      bindings.has(binding.toLowerCase())
    )
      throw new Error('Shortcuts must be valid and unique');
    const parts = binding.split('+');
    const keyName = parts.pop()!;
    if (new Set(parts).size !== parts.length)
      throw new Error('Duplicate shortcut modifier');
    const canonical = [
      ...['Ctrl', 'Alt', 'Shift'].filter((part) => parts.includes(part)),
      keyName,
    ].join('+');
    if (bindings.has(canonical.toLowerCase()))
      throw new Error('Shortcuts must be unique');
    bindings.add(canonical.toLowerCase());
    shortcuts[key] = canonical;
  }
  if (Object.keys(v.shortcuts).some((key) => !(key in DEFAULT_SHORTCUTS)))
    throw new Error('Unknown shortcut');
  return { ...structuredClone(v), shortcuts };
}
export function searchTemplate(settings: Settings): string {
  return {
    google: 'https://www.google.com/search?q={query}',
    duckduckgo: 'https://duckduckgo.com/?q={query}',
    brave: 'https://search.brave.com/search?q={query}',
    startpage: 'https://www.startpage.com/sp/search?query={query}',
    custom: settings.customSearch,
  }[settings.searchEngine];
}
// nativeGlass: the window itself is translucent (Windows acrylic / macOS vibrancy),
// so the chrome only tints it instead of painting a fallback backdrop.
export function themeCSS(
  settings: Settings,
  dark: boolean,
  nativeGlass = false,
): string {
  const channels = settings.accent
    .slice(1)
    .match(/../g)!
    .map((x) => {
      const c = parseInt(x, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  // Leans to white text like macOS, so saturated accents get white labels.
  const foreground = luminance > 0.26 ? '#000000' : '#ffffff';
  const glass = settings.glassEffect;
  const pick = (light: string, darkValue: string) => (dark ? darkValue : light);
  // With glass off every translucent token falls back to an opaque one.
  const tone = (light: string, darkValue: string, solid: string) =>
    glass ? pick(light, darkValue) : solid;
  const base = pick('#eef0f5', '#15161b');
  // Zen-style backdrop: the accent washes in from the top corner and a warm
  // tint from the bottom. Over native acrylic the base stays translucent.
  const layer = nativeGlass ? `${base}a6` : base;
  const wallpaper = settings.wallpaper
    ? `url("${settings.wallpaper}")`
    : glass
      ? `radial-gradient(110% 80% at 0% 0%,color-mix(in srgb,${settings.accent} ${dark ? 28 : 24}%,transparent),transparent 65%),radial-gradient(90% 70% at 100% 100%,color-mix(in srgb,${pick('#ffb38a 30%', '#ff8a65 12%')},transparent),transparent 60%),linear-gradient(${layer},${layer})`
      : 'none';
  const tokens: Record<string, string> = {
    'color-scheme': dark ? 'dark' : 'light',
    '--chrome-bg': base,
    '--backdrop': glass && nativeGlass ? 'transparent' : base,
    '--wallpaper-image': wallpaper,
    '--glass': tone('#ffffff8c', '#ffffff14', pick('#e3e5ea', '#26272c')),
    '--glass-strong': tone(
      '#ffffffd9',
      '#ffffff24',
      pick('#ffffff', '#33343a'),
    ),
    '--glass-edge': tone('#ffffffb3', '#ffffff1f', pick('#d6d8de', '#3a3b41')),
    '--glass-blur': glass ? '24px' : '0px',
    '--hairline': pick('#0000001a', '#ffffff17'),
    '--surface': pick('#ffffff', '#1e1f23'),
    '--panel': tone('#f9f9fbe0', '#26272be6', pick('#f9f9fb', '#26272b')),
    '--input-bg': pick('#0000000d', '#ffffff12'),
    '--hover': pick('#0000000d', '#ffffff12'),
    '--selection': tone('#ffffffd9', '#ffffff24', pick('#ffffff', '#33343a')),
    '--text': pick('#1d1d1f', '#f5f5f7'),
    '--muted': pick('#6e6e73', '#a1a1a6'),
    '--border': pick('#d2d2d7', '#3a3a3f'),
    '--error': pick('#d70015', '#ff6961'),
    '--shadow-sm': pick(
      '0 1px 2px #0000000f,0 2px 8px #1e14500f',
      '0 1px 2px #0000004d,0 2px 8px #00000033',
    ),
    '--shadow-lg': pick(
      '0 1px 2px #0000000d,0 12px 40px #1e14501f',
      '0 1px 2px #00000066,0 16px 48px #00000080',
    ),
    '--accent': settings.accent,
    '--accent-text': foreground,
    '--icon-accent': settings.accent,
    '--radius': `${settings.radius}px`,
    '--control-size': settings.density === 'compact' ? '28px' : '32px',
    '--tab-height': settings.density === 'compact' ? '30px' : '34px',
  };
  return `:root{${Object.entries(tokens)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')}}`;
}
