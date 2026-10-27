import type Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import type {
  Bookmark,
  BookmarkCommand,
  HistoryEntry,
  LibraryData,
} from '../shared/browser';
import { isWebURL, navigationURL } from '../shared/navigation';

type SavedLibrary = { history: HistoryEntry[]; bookmarks: Bookmark[] };
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}
function timestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
export function parseLibrary(value: unknown): SavedLibrary | null {
  if (
    !record(value) ||
    !Array.isArray(value.history) ||
    value.history.length > 5000 ||
    !Array.isArray(value.bookmarks) ||
    value.bookmarks.length > 2000
  )
    return null;
  const urls = new Set<string>();
  const ids = new Set<string>();
  const bookmarkURLs = new Set<string>();
  for (const item of value.history) {
    if (
      !record(item) ||
      !text(item.url, 8192) ||
      !isWebURL(item.url) ||
      urls.has(item.url) ||
      !text(item.title, 1024) ||
      !timestamp(item.lastVisited) ||
      !Number.isSafeInteger(item.visits) ||
      (item.visits as number) < 1
    )
      return null;
    urls.add(item.url);
  }
  for (const item of value.bookmarks) {
    if (
      !record(item) ||
      !text(item.id, 80) ||
      !item.id ||
      ids.has(item.id) ||
      !text(item.url, 8192) ||
      !isWebURL(item.url) ||
      bookmarkURLs.has(item.url) ||
      !text(item.title, 1024) ||
      !text(item.folder, 80) ||
      !timestamp(item.createdAt)
    )
      return null;
    ids.add(item.id);
    bookmarkURLs.add(item.url);
  }
  return {
    history: value.history as HistoryEntry[],
    bookmarks: value.bookmarks as Bookmark[],
  };
}
export function parseBookmark(value: unknown): BookmarkCommand {
  if (!record(value)) throw new Error('Invalid bookmark.');
  if (
    value.type === 'remove' &&
    text(value.id, 80) &&
    value.id &&
    Object.keys(value).every((key) => ['type', 'id'].includes(key))
  )
    return { type: 'remove', id: value.id };
  if (
    value.type === 'save' &&
    text(value.url, 8192) &&
    isWebURL(value.url) &&
    text(value.title, 1024) &&
    text(value.folder, 80) &&
    (!('id' in value) || (text(value.id, 80) && !!value.id)) &&
    Object.keys(value).every((key) =>
      ['type', 'id', 'url', 'title', 'folder'].includes(key),
    )
  )
    return {
      type: 'save',
      ...(typeof value.id === 'string' ? { id: value.id } : {}),
      url: navigationURL(value.url),
      title: value.title.trim() || value.url.slice(0, 1024),
      folder: value.folder.trim() || 'Bookmarks',
    };
  throw new Error('Enter a valid web address, title, and folder.');
}
export class BrowserLibrary {
  private value: SavedLibrary = { history: [], bookmarks: [] };
  private store: Store<{ library: unknown }> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  error: string | null = null;
  constructor(private changed: () => void) {}
  async load() {
    try {
      const { default: ElectronStore } = await import('electron-store');
      const store = new ElectronStore<{ library: unknown }>({
        name: 'library',
      });
      const raw = store.get('library');
      const parsed = raw === undefined ? this.value : parseLibrary(raw);
      if (!parsed) throw new Error('Invalid saved library.');
      this.value = parsed;
      this.store = store;
    } catch {
      this.error =
        'History and bookmark storage is unavailable. The original file is preserved; changes will not be saved.';
    }
  }
  get data(): LibraryData {
    return { ...this.value, error: this.error };
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
    this.changed();
  }
  visit(url: string, title: string, increment: boolean) {
    if (!isWebURL(url)) return;
    const previous = this.value.history.find((item) => item.url === url);
    if (!increment && !previous) return;
    const entry = {
      url,
      title: title.slice(0, 1024) || url,
      lastVisited: increment ? Date.now() : previous!.lastVisited,
      visits: (previous?.visits ?? 0) + (increment ? 1 : 0),
    };
    this.value.history = [
      entry,
      ...this.value.history.filter((item) => item.url !== url),
    ]
      .sort((a, b) => b.lastVisited - a.lastVisited)
      .slice(0, 5000);
    this.schedule();
  }
  bookmark(command: BookmarkCommand) {
    if (command.type === 'remove') {
      if (!this.value.bookmarks.some((item) => item.id === command.id))
        throw new Error('Bookmark no longer exists.');
      this.value.bookmarks = this.value.bookmarks.filter(
        (item) => item.id !== command.id,
      );
    } else {
      const previous = this.value.bookmarks.find((item) =>
        command.id ? item.id === command.id : item.url === command.url,
      );
      if (command.id && !previous)
        throw new Error('Bookmark no longer exists.');
      if (
        this.value.bookmarks.some(
          (item) => item.url === command.url && item.id !== previous?.id,
        )
      )
        throw new Error('That address is already bookmarked.');
      if (!previous && this.value.bookmarks.length >= 2000)
        throw new Error('The bookmark limit has been reached.');
      this.value.bookmarks = [
        {
          id: previous?.id ?? randomUUID(),
          url: command.url,
          title: command.title,
          folder: command.folder,
          createdAt: previous?.createdAt ?? Date.now(),
        },
        ...this.value.bookmarks.filter((item) => item.id !== previous?.id),
      ];
    }
    this.schedule();
  }
  clearHistory() {
    this.value.history = [];
    this.schedule();
  }
  flush() {
    clearTimeout(this.timer);
    if (!this.store) return;
    try {
      this.store.set('library', this.value);
      if (this.error) {
        this.error = null;
        this.changed();
      }
    } catch {
      this.error =
        'History and bookmarks could not be saved. Check available disk space and file permissions.';
      this.changed();
    }
  }
}
