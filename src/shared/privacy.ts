export interface PrivacySettings {
  disabledSites: string[];
  httpSites: string[];
  deniedPermissions: Record<string, string[]>;
  httpsOnly: boolean;
  clearOnExit: boolean;
  dns: 'system' | 'cloudflare' | 'quad9';
}
export interface ShieldsState {
  origin: string;
  site: string;
  enabled: boolean;
  blocked: number;
  pendingHTTP: string | null;
  filterError: string | null;
  updatedAt: number;
  settings: PrivacySettings;
  privateWindow: boolean;
}
export type PrivacyCommand =
  | { type: 'update-filters' }
  | { type: 'site'; enabled: boolean }
  | { type: 'allow-http' }
  | {
      type: 'options';
      httpsOnly: boolean;
      clearOnExit: boolean;
      dns: PrivacySettings['dns'];
    }
  | { type: 'permission'; permission: string; denied: boolean };
export const DEFAULT_PRIVACY: PrivacySettings = {
  disabledSites: [],
  httpSites: [],
  deniedPermissions: {},
  httpsOnly: true,
  clearOnExit: false,
  dns: 'system',
};
