import { isPageURL } from '../shared/navigation';
import { SIDEBAR_WIDTH } from '../shared/browser';
import type {
  SidebarPreferences,
  SidebarUpdate,
  TabCommand,
} from '../shared/browser';

export interface SavedTab {
  id: string;
  url: string;
  title: string;
  muted: boolean;
}
export interface SavedSession {
  version: 1;
  tabs: SavedTab[];
  activeTabId: string;
  sidebar: SidebarPreferences;
}
export const DEFAULT_SIDEBAR: SidebarPreferences = {
  pinned: false,
  width: SIDEBAR_WIDTH,
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseSidebar(value: unknown): SidebarUpdate {
  if (
    !record(value) ||
    Object.keys(value).length === 0 ||
    Object.keys(value).some(
      (key) => !['pinned', 'width', 'expanded'].includes(key),
    )
  )
    throw new Error('Invalid sidebar preferences.');
  if (
    ('pinned' in value && typeof value.pinned !== 'boolean') ||
    ('expanded' in value && typeof value.expanded !== 'boolean') ||
    ('width' in value &&
      (!Number.isInteger(value.width) ||
        (value.width as number) < 220 ||
        (value.width as number) > 360))
  )
    throw new Error('Invalid sidebar preferences.');
  return value as SidebarUpdate;
}
export function parseTabCommand(value: unknown): TabCommand {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 80 ||
    typeof value.type !== 'string' ||
    ![
      'select',
      'close',
      'duplicate',
      'mute',
      'close-others',
      'move',
      'menu',
    ].includes(value.type)
  )
    throw new Error('Invalid tab command.');
  if (
    Object.keys(value).some(
      (key) =>
        !['id', 'type', ...(value.type === 'move' ? ['index'] : [])].includes(
          key,
        ),
    )
  )
    throw new Error('Invalid tab command.');
  if (
    value.type === 'move' &&
    (!Number.isInteger(value.index) || (value.index as number) < 0)
  )
    throw new Error('Invalid tab position.');
  return value as TabCommand;
}
export function parseSession(value: unknown): SavedSession | null {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tabs) ||
    !value.tabs.length ||
    value.tabs.length > 1000 ||
    typeof value.activeTabId !== 'string' ||
    !record(value.sidebar)
  )
    return null;
  try {
    parseSidebar(value.sidebar);
  } catch {
    return null;
  }
  if (
    typeof value.sidebar.pinned !== 'boolean' ||
    typeof value.sidebar.width !== 'number' ||
    'expanded' in value.sidebar
  )
    return null;
  const ids = new Set<string>();
  const tabs: SavedTab[] = [];
  for (const tab of value.tabs) {
    if (
      !record(tab) ||
      typeof tab.id !== 'string' ||
      !/^[a-z\d-]{1,80}$/i.test(tab.id) ||
      ids.has(tab.id) ||
      typeof tab.url !== 'string' ||
      !isPageURL(tab.url) ||
      typeof tab.title !== 'string' ||
      tab.title.length > 1024 ||
      typeof tab.muted !== 'boolean'
    )
      return null;
    ids.add(tab.id);
    tabs.push({ id: tab.id, url: tab.url, title: tab.title, muted: tab.muted });
  }
  if (!ids.has(value.activeTabId)) return null;
  return {
    version: 1,
    tabs,
    activeTabId: value.activeTabId,
    sidebar: { pinned: value.sidebar.pinned, width: value.sidebar.width },
  };
}
