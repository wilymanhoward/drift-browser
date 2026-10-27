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
  onFocusAddress(callback: () => void): () => void;
}
