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
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [
      `workspace-${i + 1}`,
      `Ctrl+Alt+${i + 1}`,
    ]),
  ),
};
export interface Settings {
  theme: 'light' | 'dark' | 'system';
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
  unloadMinutes: number;
  shortcuts: Record<string, string>;
}
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#466a55',
  sidebarPosition: 'left',
  collapsedWidth: 48,
  expandedWidth: 224,
  density: 'comfortable',
  radius: 8,
  contentInset: true,
  contentShadow: false,
  wallpaper: '',
  customCSS: '',
  startup: 'restore',
  searchEngine: 'google',
  customSearch: 'https://www.google.com/search?q={query}',
  hoverExpand: true,
  unloadMinutes: 30,
  shortcuts: DEFAULT_SHORTCUTS,
};
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid settings');
  const v = value as Settings;
  if (
    Object.keys(v).some((key) => !(key in DEFAULT_SETTINGS)) ||
    !['light', 'dark', 'system'].includes(v.theme) ||
    !/^#[\da-f]{6}$/i.test(v.accent) ||
    !['left', 'right'].includes(v.sidebarPosition) ||
    !Number.isInteger(v.collapsedWidth) ||
    v.collapsedWidth < 40 ||
    v.collapsedWidth > 80 ||
    !Number.isInteger(v.expandedWidth) ||
    v.expandedWidth < 220 ||
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
    !Number.isInteger(v.unloadMinutes) ||
    v.unloadMinutes < 1 ||
    v.unloadMinutes > 1440 ||
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
      !/^(?:(?:Ctrl|Alt|Shift)\+)*(?:[A-Za-z0-9,]|Tab|F(?:[1-9]|1[0-2]))$/.test(
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
export function themeCSS(settings: Settings, dark: boolean): string {
  const channels = settings.accent
    .slice(1)
    .match(/../g)!
    .map((x) => {
      const c = parseInt(x, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const foreground = luminance > 0.179 ? '#000000' : '#ffffff';
  const readableAccent = dark ? '#b8d3bd' : '#35543d';
  return `:root{color-scheme:${dark ? 'dark' : 'light'};--chrome-bg:${dark ? '#202722' : '#eeede9'};--surface:${dark ? '#29332c' : '#f8f8f5'};--input-bg:${dark ? '#202722' : '#ffffff'};--text:${dark ? '#edf1eb' : '#303833'};--muted:${dark ? '#b8c8b7' : '#535f55'};--border:${dark ? '#81917f' : '#7c867b'};--hover:${dark ? '#3b4a3d' : '#dedfd9'};--selection:${dark ? '#3b4e3e' : '#dce4da'};--error:${dark ? '#ffb4a8' : '#8d2e25'};--accent:${settings.accent};--icon-accent:${readableAccent};--accent-text:${foreground};--radius:${settings.radius}px;--control-size:${settings.density === 'compact' ? 28 : 32}px;--tab-height:${settings.density === 'compact' ? 32 : 40}px;}`;
}
