import type { Settings } from './settings';
export interface BrowserImportExtension {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  compatible: boolean;
}
export interface BrowserImportSource {
  id: string;
  browser: string;
  profile: string;
  bookmarks: boolean;
  preferences: boolean;
  extensions: BrowserImportExtension[];
}
export interface BrowserImportRequest {
  id: string;
  bookmarks: boolean;
  preferences: boolean;
  extensions: string[];
}
export interface BrowserImportResult {
  bookmarksAdded: number;
  bookmarksSkipped: number;
  preferences: string[];
  warnings: string[];
  extensionsAdded: number;
}
export type ImportedPreferences = Partial<
  Pick<Settings, 'theme' | 'startup' | 'searchEngine' | 'customSearch'>
>;
export function parseBrowserImport(value: unknown): BrowserImportRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid browser import');
  const v = value as BrowserImportRequest;
  if (
    typeof v.id !== 'string' ||
    !/^[a-f0-9]{24}$/.test(v.id) ||
    typeof v.bookmarks !== 'boolean' ||
    typeof v.preferences !== 'boolean' ||
    !Array.isArray(v.extensions) ||
    v.extensions.length > 100 ||
    v.extensions.some(
      (id) => typeof id !== 'string' || !/^[a-p]{32}$/.test(id),
    ) ||
    new Set(v.extensions).size !== v.extensions.length ||
    (!v.bookmarks && !v.preferences && !v.extensions.length) ||
    Object.keys(v).some(
      (key) => !['id', 'bookmarks', 'preferences', 'extensions'].includes(key),
    )
  )
    throw new Error('Select a browser profile and data to import.');
  return v;
}
