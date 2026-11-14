import { isPageURL } from '../shared/navigation';
import { GROUP_COLORS, SIDEBAR_WIDTH } from '../shared/browser';
import type { TabGroup } from '../shared/browser';
import { parseWorkspace } from '../shared/power';
import type { Workspace } from '../shared/power';
import type {
  SidebarPreferences,
  SidebarUpdate,
  TabCardAnchor,
  TabCommand,
} from '../shared/browser';

export interface SavedTab {
  id: string;
  url: string;
  title: string;
  muted: boolean;
  workspaceId?: string;
  pinned?: boolean;
  // The profile Essential this pinned tab stands for.
  essentialId?: string;
  groupId?: string;
  // A small data: URL of the tab's site icon, shown before the tab loads.
  favicon?: string | null;
}
export interface SavedSession {
  version: 1;
  tabs: SavedTab[];
  activeTabId: string;
  sidebar: SidebarPreferences;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  groups?: TabGroup[];
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
      (key) => !['pinned', 'width', 'expanded', 'topbar'].includes(key),
    )
  )
    throw new Error('Invalid sidebar preferences.');
  if (
    ('pinned' in value && typeof value.pinned !== 'boolean') ||
    ('expanded' in value && typeof value.expanded !== 'boolean') ||
    ('topbar' in value && typeof value.topbar !== 'boolean') ||
    ('width' in value &&
      (!Number.isInteger(value.width) ||
        (value.width as number) < 208 ||
        (value.width as number) > 360))
  )
    throw new Error('Invalid sidebar preferences.');
  return value as SidebarUpdate;
}
export function parseTabCardAnchor(value: unknown): TabCardAnchor | null {
  if (value === null) return null;
  if (
    !record(value) ||
    Object.keys(value).length !== 3 ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 80 ||
    !Number.isFinite(value.top) ||
    !Number.isFinite(value.edge)
  )
    throw new Error('Invalid tab card anchor.');
  return value as unknown as TabCardAnchor;
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
      'pin',
      'sleep',
      'split',
      'detach',
      'group-menu',
      'group-toggle',
      'group-rename',
      'group',
    ].includes(value.type)
  )
    throw new Error('Invalid tab command.');
  const extra =
    value.type === 'move'
      ? 'index'
      : value.type === 'group-rename'
        ? 'name'
        : value.type === 'group'
          ? 'group'
          : '';
  if (
    Object.keys(value).some(
      (key) => !['id', 'type', ...(extra ? [extra] : [])].includes(key),
    )
  )
    throw new Error('Invalid tab command.');
  if (
    value.type === 'group' &&
    (typeof value.group !== 'string' || value.group.length > 80)
  )
    throw new Error('Invalid group.');
  if (
    value.type === 'group-rename' &&
    (typeof value.name !== 'string' || value.name.length > 200)
  )
    throw new Error('Invalid group name.');
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
  let workspaces: Workspace[] | undefined;
  if (value.workspaces !== undefined) {
    if (
      !Array.isArray(value.workspaces) ||
      !value.workspaces.length ||
      value.workspaces.length > 9
    )
      return null;
    const workspaceIds = new Set<string>();
    workspaces = [];
    try {
      for (const raw of value.workspaces) {
        if (!record(raw)) return null;
        const command = parseWorkspace({ ...raw, type: 'save' });
        if (
          command.type !== 'save' ||
          !command.id ||
          workspaceIds.has(command.id)
        )
          return null;
        workspaceIds.add(command.id);
        workspaces.push({
          id: command.id,
          name: command.name,
          icon: command.icon,
          accent: command.accent,
        });
      }
      if (!workspaceIds.has(String(value.activeWorkspaceId))) return null;
    } catch {
      return null;
    }
  } else if (value.activeWorkspaceId !== undefined) return null;
  // Bad groups are dropped rather than failing the whole session.
  const groups: TabGroup[] = (Array.isArray(value.groups) ? value.groups : [])
    .filter(
      (g): g is TabGroup =>
        record(g) &&
        typeof g.id === 'string' &&
        /^[a-z\d-]{1,80}$/i.test(g.id) &&
        typeof g.name === 'string' &&
        g.name.length <= 40 &&
        Object.hasOwn(GROUP_COLORS, String(g.color)) &&
        typeof g.collapsed === 'boolean',
    )
    .slice(0, 50)
    .map(({ id, name, color, collapsed }) => ({ id, name, color, collapsed }));
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
    if (
      (tab.pinned !== undefined && typeof tab.pinned !== 'boolean') ||
      (workspaces && !workspaces.some((w) => w.id === tab.workspaceId)) ||
      (!workspaces && tab.workspaceId !== undefined)
    )
      return null;
    tabs.push({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      muted: tab.muted,
      // A bad icon is dropped rather than failing the whole session.
      ...(typeof tab.favicon === 'string' &&
      tab.favicon.length <= 16 * 1024 &&
      /^data:image\/[\w.+-]+;base64,[a-z\d+/]+=*$/i.test(tab.favicon)
        ? { favicon: tab.favicon }
        : {}),
      ...(workspaces
        ? { workspaceId: String(tab.workspaceId), pinned: tab.pinned === true }
        : {}),
      ...(tab.pinned === true &&
      typeof tab.essentialId === 'string' &&
      /^[a-z\d-]{1,80}$/i.test(tab.essentialId)
        ? { essentialId: tab.essentialId }
        : {}),
      ...(tab.pinned !== true && groups.some((g) => g.id === tab.groupId)
        ? { groupId: String(tab.groupId) }
        : {}),
    });
  }
  if (!ids.has(value.activeTabId)) return null;
  return {
    version: 1,
    tabs,
    activeTabId: value.activeTabId,
    sidebar: { pinned: value.sidebar.pinned, width: value.sidebar.width },
    ...(workspaces
      ? { workspaces, activeWorkspaceId: String(value.activeWorkspaceId) }
      : {}),
    ...(groups.length ? { groups } : {}),
  };
}
