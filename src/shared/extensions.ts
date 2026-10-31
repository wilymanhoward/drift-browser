export const WEB_STORE_URL = 'https://chromewebstore.google.com/category/extensions';
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
