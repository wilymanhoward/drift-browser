export const SIDEBAR_WIDTH = 224;
export const COLLAPSED_WIDTH = 48;
export const CONTENT_INSET = 8;
export const ACTIONS = [
  'back',
  'forward',
  'reload',
  'minimize',
  'maximize',
  'close',
  'new-tab',
  'reopen-tab',
  'open-command',
  'show-history',
  'show-bookmarks',
] as const;
export type BrowserAction = (typeof ACTIONS)[number];
export interface TabState {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error: string | null;
  favicon: string | null;
  audible: boolean;
  muted: boolean;
}
export interface SidebarPreferences {
  pinned: boolean;
  width: number;
}
export interface BrowserState extends Omit<TabState, 'id'> {
  tabs: TabState[];
  activeTabId: string;
  maximized: boolean;
  canReopen: boolean;
  sidebar: SidebarPreferences & { expanded: boolean };
  storageError: string | null;
  overlay: 'command' | 'history' | 'bookmarks' | null;
}
export type TabCommand =
  | {
      type: 'select' | 'close' | 'duplicate' | 'mute' | 'close-others' | 'menu';
      id: string;
    }
  | { type: 'move'; id: string; index: number };
export type SidebarUpdate = Partial<SidebarPreferences> & {
  expanded?: boolean;
};
export interface DriftAPI {
  getState(): Promise<BrowserState>;
  navigate(url: string): Promise<void>;
  action(action: BrowserAction): Promise<void>;
  tab(command: TabCommand): Promise<void>;
  sidebar(update: SidebarUpdate): Promise<void>;
  onState(callback: (state: BrowserState) => void): () => void;
  closeOverlay(): Promise<void>;
  getLibrary(): Promise<LibraryData>;
  bookmark(command: BookmarkCommand): Promise<void>;
  clearHistory(): Promise<void>;
  onOverlay(callback: (overlay: OverlayEvent) => void): () => void;
}

export interface HistoryEntry {
  url: string;
  title: string;
  lastVisited: number;
  visits: number;
}
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  folder: string;
  createdAt: number;
}
export interface LibraryData {
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  error: string | null;
}
export type BookmarkCommand =
  | { type: 'save'; id?: string; url: string; title: string; folder: string }
  | { type: 'remove'; id: string };
export interface OverlayEvent {
  kind: 'command' | 'history' | 'bookmarks';
  newTab: boolean;
  query: string;
  snapshot: string | null;
  bounds: { x: number; y: number; width: number; height: number };
}
