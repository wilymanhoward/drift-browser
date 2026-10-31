export interface Workspace {
  id: string;
  name: string;
  icon: string;
  accent: string;
}
export const DEFAULT_WORKSPACE: Workspace = {
  id: 'personal',
  name: 'Personal',
  icon: '◉',
  accent: '#007aff',
};
export type WorkspaceCommand =
  | { type: 'save'; id?: string; name: string; icon: string; accent: string }
  | { type: 'select' | 'remove'; id: string }
  | { type: 'move-tab'; id: string; tabId: string };
export function parseWorkspace(input: unknown): WorkspaceCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid workspace');
  const v = input as Record<string, unknown>;
  const keys =
    v.type === 'save'
      ? ['type', 'id', 'name', 'icon', 'accent']
      : v.type === 'move-tab'
        ? ['type', 'id', 'tabId']
        : ['type', 'id'];
  if (
    Object.keys(v).some((k) => !keys.includes(k)) ||
    !['save', 'select', 'remove', 'move-tab'].includes(String(v.type))
  )
    throw new Error('Invalid workspace command');
  if (
    (v.id !== undefined || v.type !== 'save') &&
    (typeof v.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(v.id))
  )
    throw new Error('Invalid workspace ID');
  if (
    v.type === 'save' &&
    (typeof v.name !== 'string' ||
      !v.name.trim() ||
      v.name.length > 40 ||
      typeof v.icon !== 'string' ||
      !v.icon.trim() ||
      v.icon.length > 8 ||
      typeof v.accent !== 'string' ||
      !/^#[\da-f]{6}$/i.test(v.accent))
  )
    throw new Error('Invalid workspace details');
  if (
    v.type === 'move-tab' &&
    (typeof v.tabId !== 'string' || !/^[a-z\d-]{1,80}$/i.test(v.tabId))
  )
    throw new Error('Invalid tab ID');
  return v as unknown as WorkspaceCommand;
}
export interface DownloadState {
  id: string;
  name: string;
  received: number;
  total: number;
  status: 'progressing' | 'interrupted' | 'completed' | 'cancelled';
  paused: boolean;
  resumable: boolean;
  done: boolean;
}
export type DownloadCommand = {
  id: string;
  type: 'pause' | 'resume' | 'cancel' | 'reveal' | 'remove';
};
export function parseDownload(input: unknown): DownloadCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid download command');
  const v = input as DownloadCommand;
  if (
    Object.keys(v).some((k) => !['id', 'type'].includes(k)) ||
    typeof v.id !== 'string' ||
    v.id.length > 80 ||
    !['pause', 'resume', 'cancel', 'reveal', 'remove'].includes(v.type)
  )
    throw new Error('Invalid download command');
  return v;
}
