export const WEB_STORE_URL =
  'https://chromewebstore.google.com/category/extensions';
// Chrome extension ids are 32 letters from a to p.
const ID = /^[a-p]{32}$/;
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string | null;
  hasOptions: boolean;
  hasAction: boolean;
  hidden: boolean;
}
export interface ExtensionsState {
  available: boolean;
  extensions: ExtensionInfo[];
  error: string | null;
}
export type ExtensionCommand =
  | { type: 'store' }
  | { type: 'remove' | 'options' | 'toggle-toolbar'; id: string };

export function isExtensionURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'chrome-extension:' && ID.test(url.hostname);
  } catch {
    return false;
  }
}
export function parseExtensionCommand(value: unknown): ExtensionCommand {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid extension command.');
  const command = value as Record<string, unknown>;
  if (command.type === 'store' && Object.keys(command).length === 1)
    return { type: 'store' };
  if (
    ['remove', 'options', 'toggle-toolbar'].includes(String(command.type)) &&
    Object.keys(command).length === 2 &&
    typeof command.id === 'string' &&
    ID.test(command.id)
  )
    return command as ExtensionCommand;
  throw new Error('Invalid extension command.');
}

export interface ExtensionManifest {
  permissions?: unknown;
  host_permissions?: unknown;
  optional_permissions?: unknown;
  optional_host_permissions?: unknown;
  content_scripts?: unknown;
}
// The only page allowed to ask for a Chrome Web Store install. The library
// itself accepts any origin that merely starts with this text.
export const WEB_STORE_ORIGIN = 'https://chromewebstore.google.com';
export const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
// Everything an extension can reach without asking again: API permissions,
// host permissions and the pages its content scripts run on.
export function grantedPermissions(manifest: ExtensionManifest): string[] {
  const scripts = Array.isArray(manifest.content_scripts)
    ? manifest.content_scripts.flatMap((script) =>
        strings((script as { matches?: unknown } | null)?.matches),
      )
    : [];
  return [
    ...new Set([
      ...strings(manifest.permissions),
      ...strings(manifest.host_permissions),
      ...scripts,
    ]),
  ].sort();
}
export function optionalPermissions(manifest: ExtensionManifest): string[] {
  return [
    ...new Set([
      ...strings(manifest.optional_permissions),
      ...strings(manifest.optional_host_permissions),
    ]),
  ].sort();
}
// Only the Web Store's own top-level page may start an install.
export function trustedInstallFrame(
  frame: { url: string; parent?: unknown } | null | undefined,
): boolean {
  if (!frame) return true;
  try {
    return !frame.parent && new URL(frame.url).origin === WEB_STORE_ORIGIN;
  } catch {
    return false;
  }
}
