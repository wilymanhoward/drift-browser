export const SIDEBAR_WIDTH = 224;
export const CONTENT_INSET = 8;
export const ACTIONS = [
  'back',
  'forward',
  'reload',
  'minimize',
  'maximize',
  'close',
] as const;
export type BrowserAction = (typeof ACTIONS)[number];
export interface BrowserState {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  maximized: boolean;
  error: string | null;
}
export interface DriftAPI {
  getState(): Promise<BrowserState>;
  navigate(url: string): Promise<void>;
  action(action: BrowserAction): Promise<void>;
  onState(callback: (state: BrowserState) => void): () => void;
}
