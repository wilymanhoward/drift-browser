import { app, dialog, webContents } from 'electron';
import type { BrowserWindow, Session, WebContents } from 'electron';
import type Store from 'electron-store';
import {
  ElectronBlocker,
  fromElectronDetails,
} from '@ghostery/adblocker-electron';
import { getDomain } from 'tldts';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_PRIVACY } from '../shared/privacy';
import type {
  PrivacySettings,
  ShieldsState,
  PrivacyCommand,
} from '../shared/privacy';
import { isWebURL } from '../shared/navigation';
import { enableCosmetics } from './cosmetics';

// Ship network rules, cosmetics and their scriptlets together so the first
// page never starts with only half of the blocking rules.
const MIRROR =
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets';
const REMOTE = [
  'easylist/easylist.txt',
  'easylist/easyprivacy.txt',
  'peter-lowe/serverlist.txt',
  'ublock-origin/filters.txt',
  'ublock-origin/quick-fixes.txt',
  'ublock-origin/badware.txt',
  'ublock-origin/privacy.txt',
  'ublock-origin/resource-abuse.txt',
  'ublock-origin/unbreak.txt',
];
const REFRESH = 86400000;
let engine: ElectronBlocker;
let updatedAt = 0;
let filterError: string | null = null;
let refreshing: Promise<void> | null = null;
let activeDNS: PrivacySettings['dns'] = 'system';
function configureDNS(dns: PrivacySettings['dns']) {
  app.configureHostResolver({
    enableBuiltInResolver: dns !== 'system',
    secureDnsMode: dns === 'system' ? 'off' : 'secure',
    secureDnsServers:
      dns === 'cloudflare'
        ? ['https://cloudflare-dns.com/dns-query']
        : dns === 'quad9'
          ? ['https://dns.quad9.net/dns-query']
          : [],
  });
  activeDNS = dns;
}
export async function loadFilters() {
  const cache = path.join(app.getPath('userData'), 'filters');
  const cached = path.join(cache, 'engine.bin');
  await mkdir(cache, { recursive: true });
  const bundled = path.join(app.getAppPath(), 'assets/filters');
  const snapshot = JSON.parse(
    await readFile(path.join(bundled, 'full-engine.json'), 'utf8'),
  ) as { updatedAt: number };
  const fallback = await readFile(path.join(bundled, 'full-engine.bin'));
  try {
    engine = ElectronBlocker.deserialize(await readFile(cached));
    updatedAt = (await stat(cached)).mtimeMs;
    if (updatedAt < snapshot.updatedAt || !engine.resources.scriptlets.length)
      throw new Error('Incomplete or superseded filters');
  } catch {
    engine = ElectronBlocker.deserialize(fallback);
    updatedAt = snapshot.updatedAt;
  }
  const update = () => {
    if (Date.now() - updatedAt >= REFRESH)
      void refreshFilters().catch(() => undefined);
  };
  update();
  setInterval(update, 3600000).unref();
}
export function refreshFilters(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const cached = path.join(app.getPath('userData'), 'filters/engine.bin');
    try {
      const download = async (file: string) => {
        const response = await fetch(`${MIRROR}/${file}`, {
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error('Filter download failed');
        return response.text();
      };
      const [resources, ...text] = await Promise.all([
        download('ublock-origin/resources.json'),
        ...REMOTE.map(download),
      ]);
      if (
        text.some((body) => body.length < 1000 || /^\s*</.test(body)) ||
        !resources.startsWith('{')
      )
        throw new Error('Invalid filter list');
      const next = ElectronBlocker.parse(text.join('\n'), {
        enableCompression: true,
      });
      next.updateResources(
        resources,
        createHash('sha256').update(resources).digest('hex'),
      );
      if (!next.resources.scriptlets.length)
        throw new Error('Missing scriptlets');
      await writeFile(`${cached}.tmp`, next.serialize());
      await rename(`${cached}.tmp`, cached);
      engine = next;
      updatedAt = Date.now();
      filterError = null;
    } catch {
      filterError =
        'Filter updates failed; the last working bundled or cached rules remain active.';
      throw new Error(filterError);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
export function cleanTracking(url: string): string {
  if (!isWebURL(url)) return url;
  const value = new URL(url);
  for (const key of [...value.searchParams.keys()])
    if (
      /^utm_/i.test(key) ||
      /^(fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid)$/i.test(key)
    )
      value.searchParams.delete(key);
  return value.href;
}
export function localHost(host: string): boolean {
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(host) ||
    host.endsWith('.localhost')
  );
}
export function thirdParty(url: string, top: string): boolean {
  try {
    const a = new URL(url),
      b = new URL(top);
    return (
      (getDomain(a.hostname) || a.hostname) !==
        (getDomain(b.hostname) || b.hostname) || a.protocol !== b.protocol
    );
  } catch {
    return true;
  }
}
function parse(value: unknown): PrivacySettings {
  if (!value || typeof value !== 'object')
    return structuredClone(DEFAULT_PRIVACY);
  const v = value as PrivacySettings;
  if (
    !Array.isArray(v.disabledSites) ||
    !v.disabledSites.every((x) => typeof x === 'string') ||
    !Array.isArray(v.httpSites) ||
    !v.httpSites.every((x) => typeof x === 'string') ||
    typeof v.httpsOnly !== 'boolean' ||
    typeof v.clearOnExit !== 'boolean' ||
    !['system', 'cloudflare', 'quad9'].includes(v.dns) ||
    !v.deniedPermissions ||
    typeof v.deniedPermissions !== 'object' ||
    Object.values(v.deniedPermissions).some(
      (x) => !Array.isArray(x) || !x.every((y) => typeof y === 'string'),
    )
  )
    throw new Error('Invalid privacy settings');
  return v;
}
export class PrivacyController {
  private settings = structuredClone(DEFAULT_PRIVACY);
  private store: Store<{ privacy: unknown }> | null = null;
  private counts = new Map<number, number>();
  private lifetime = 0;
  private statsStore: Store<{ blocked: unknown }> | null = null;
  private statsTimer: ReturnType<typeof setTimeout> | undefined;
  private upgrades = new Map<number, string>();
  private failed = new Map<number, string>();
  private grants = new Map<number, Set<string>>();
  private active = true;
  constructor(
    private session: Session,
    // Windows of one profile share this controller; asks go to the page's own.
    private windowFor: (page: WebContents) => BrowserWindow,
    private privateWindow: boolean,
    private changed: () => void,
    private warning: (id: number) => void,
  ) {}
  async load() {
    if (!this.privateWindow) {
      try {
        const { default: Store } = await import('electron-store');
        const store = new Store<{ privacy: unknown }>({ name: 'privacy' });
        this.settings = parse(store.get('privacy'));
        this.store = store;
        const stats = new Store<{ blocked: unknown }>({ name: 'stats' });
        const saved = stats.get('blocked');
        this.lifetime =
          typeof saved === 'number' && Number.isSafeInteger(saved) && saved > 0
            ? saved
            : 0;
        this.statsStore = stats;
      } catch {
        filterError =
          'Privacy preferences could not be read. Defaults are active; the original file is preserved.';
      }
    }
    if (!this.privateWindow) configureDNS(this.settings.dns);
    this.attach();
  }
  get lifetimeBlocked() {
    return this.lifetime;
  }
  get configuration() {
    return this.settings;
  }
  state(id: number, url: string): ShieldsState {
    let site = '';
    try {
      site = new URL(url).hostname;
    } catch {
      /* Internal pages have no site controls. */
    }
    return {
      origin: isWebURL(url) ? new URL(url).origin : '',
      site,
      enabled: !this.settings.disabledSites.includes(site),
      blocked: this.counts.get(id) || 0,
      pendingHTTP: this.failed.get(id) || null,
      filterError,
      updatedAt,
      settings: { ...this.settings, dns: activeDNS },
      privateWindow: this.privateWindow,
    };
  }
  track(page: WebContents) {
    this.counts.set(page.id, 0);
    page.on('did-start-navigation', (_event, _url, inPlace, main) => {
      if (main && !inPlace) {
        this.counts.set(page.id, 0);
        this.grants.delete(page.id);
      }
    });
    page.on('did-fail-load', (_event, code, _description, url, main) => {
      const original = this.upgrades.get(page.id);
      if (
        main &&
        code !== -3 &&
        original &&
        new URL(original).hostname === new URL(url).hostname
      ) {
        this.failed.set(page.id, original);
        this.upgrades.delete(page.id);
        this.warning(page.id);
      }
    });
    page.on('did-finish-load', () => this.upgrades.delete(page.id));
    page.once('destroyed', () => {
      this.counts.delete(page.id);
      this.upgrades.delete(page.id);
      this.failed.delete(page.id);
      this.grants.delete(page.id);
    });
  }
  private attach() {
    const session = this.session;
    session.setUserAgent(
      session
        .getUserAgent()
        .replace(/\s(?:Drift|Electron|drift-browser)\/[^ ]+/g, '')
        .replace(/Chrome\/(\d+)\.[\d.]+/, 'Chrome/$1.0.0.0'),
    );
    enableCosmetics(
      session,
      () => engine,
      (url) => {
        try {
          return !this.settings.disabledSites.includes(new URL(url).hostname);
        } catch {
          return false;
        }
      },
    );
    const top = (id: number | undefined) =>
      id ? webContents.fromId(id)?.getURL() || '' : '';
    session.webRequest.onBeforeRequest((details, callback) => {
      if (!this.active || !isWebURL(details.url)) {
        callback({});
        return;
      }
      const url = cleanTracking(details.url);
      const parsed = new URL(url);
      if (url !== details.url) {
        callback({ redirectURL: url });
        return;
      }
      if (
        parsed.protocol === 'http:' &&
        this.settings.httpsOnly &&
        !localHost(parsed.hostname) &&
        !this.settings.httpSites.includes(parsed.hostname)
      ) {
        if (details.resourceType === 'mainFrame')
          this.upgrades.set(details.webContentsId ?? -1, url);
        parsed.protocol = 'https:';
        callback({ redirectURL: parsed.href });
        return;
      }
      const site = (() => {
        try {
          return new URL(top(details.webContentsId)).hostname;
        } catch {
          return parsed.hostname;
        }
      })();
      const result =
        details.resourceType !== 'mainFrame' &&
        !this.settings.disabledSites.includes(site)
          ? engine.match(fromElectronDetails(details))
          : null;
      const blocked = !!result && (result.match || !!result.redirect);
      if (blocked) {
        this.counts.set(
          details.webContentsId ?? -1,
          (this.counts.get(details.webContentsId ?? -1) || 0) + 1,
        );
        this.lifetime++;
        clearTimeout(this.statsTimer);
        this.statsTimer = setTimeout(() => {
          try {
            this.statsStore?.set('blocked', this.lifetime);
          } catch {
            /* Statistics are best-effort. */
          }
        }, 2000);
        this.changed();
      }
      // Redirects swap ad scripts for harmless stubs so players keep working.
      callback(
        result?.redirect
          ? { redirectURL: result.redirect.dataUrl }
          : { cancel: blocked },
      );
    });
    session.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      if (
        details.resourceType !== 'mainFrame' &&
        thirdParty(details.url, top(details.webContentsId))
      )
        for (const key of Object.keys(headers))
          if (key.toLowerCase() === 'cookie') delete headers[key];
      callback({ requestHeaders: headers });
    });
    session.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      if (
        details.resourceType !== 'mainFrame' &&
        thirdParty(details.url, top(details.webContentsId))
      )
        for (const key of Object.keys(headers))
          if (key.toLowerCase() === 'set-cookie') delete headers[key];
      callback({ responseHeaders: headers });
    });
    session.setPermissionCheckHandler(
      (page, permission, origin) =>
        !!page &&
        ((permission === 'fullscreen' && isWebURL(page.getURL())) ||
          !!this.grants.get(page.id)?.has(`${origin}|${permission}`)),
    );
    session.setPermissionRequestHandler(
      (page, permission, callback, details) => {
        let origin = '';
        try {
          origin = new URL(details.requestingUrl || page.getURL()).origin;
        } catch {
          callback(false);
          return;
        }
        if (permission === 'fullscreen') {
          callback(isWebURL(origin));
          return;
        }
        if (
          ![
            'media',
            'geolocation',
            'notifications',
            'camera',
            'microphone',
          ].includes(permission) ||
          !isWebURL(origin) ||
          this.settings.deniedPermissions[origin]?.includes(permission)
        ) {
          callback(false);
          return;
        }
        const id = page.id;
        void dialog
          .showMessageBox(this.windowFor(page), {
            type: 'question',
            title: 'Site permission',
            message: `${origin} requests ${permission} access.`,
            detail:
              'Allow applies to this page only. Your operating system may also ask for permission.',
            buttons: ['Block', 'Allow once', 'Always block for this site'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          })
          .then(({ response }) => {
            if (
              page.isDestroyed() ||
              new URL(page.getURL()).origin !== origin
            ) {
              callback(false);
              return;
            }
            if (response === 2) {
              this.settings.deniedPermissions[origin] = [
                ...new Set([
                  ...(this.settings.deniedPermissions[origin] || []),
                  permission,
                ]),
              ];
              this.save();
            }
            if (response === 1) {
              const grants = this.grants.get(id) || new Set<string>();
              grants.add(`${origin}|${permission}`);
              this.grants.set(id, grants);
            }
            callback(response === 1);
          })
          .catch(() => callback(false));
      },
    );
  }
  command(input: unknown, id: number, url: string) {
    if (!input || typeof input !== 'object')
      throw new Error('Invalid privacy command');
    const command = input as PrivacyCommand;
    const site = this.state(id, url).site;
    switch (command.type) {
      case 'site':
        if (!site || typeof command.enabled !== 'boolean')
          throw new Error('Invalid site');
        this.settings.disabledSites = this.settings.disabledSites.filter(
          (x) => x !== site,
        );
        if (!command.enabled) this.settings.disabledSites.push(site);
        break;
      case 'allow-http': {
        const original = this.failed.get(id);
        if (!original) throw new Error('No pending HTTP page');
        this.settings.httpSites = [
          ...new Set([...this.settings.httpSites, new URL(original).hostname]),
        ];
        this.failed.delete(id);
        this.save();
        return original;
      }
      case 'options':
        if (
          typeof command.httpsOnly !== 'boolean' ||
          typeof command.clearOnExit !== 'boolean' ||
          !['system', 'cloudflare', 'quad9'].includes(command.dns)
        )
          throw new Error('Invalid privacy options');
        this.settings.httpsOnly = command.httpsOnly;
        this.settings.clearOnExit = command.clearOnExit;
        this.settings.dns = command.dns;
        configureDNS(command.dns);
        break;
      case 'permission': {
        if (
          ![
            'media',
            'geolocation',
            'notifications',
            'camera',
            'microphone',
          ].includes(command.permission) ||
          typeof command.denied !== 'boolean' ||
          !isWebURL(url)
        )
          throw new Error('Invalid permission');
        const origin = new URL(url).origin;
        this.settings.deniedPermissions[origin] = (
          this.settings.deniedPermissions[origin] || []
        ).filter((x) => x !== command.permission);
        if (command.denied)
          this.settings.deniedPermissions[origin].push(command.permission);
        this.grants.delete(id);
        break;
      }
      default:
        throw new Error('Invalid privacy command');
    }
    this.save();
    return null;
  }
  private save() {
    try {
      this.store?.set('privacy', this.settings);
    } catch {
      filterError = 'Privacy settings could not be saved.';
    }
    this.changed();
  }
  async clear() {
    await this.session.clearStorageData();
    await this.session.clearCache();
    await this.session.closeAllConnections();
  }
  dispose() {
    this.active = false;
    clearTimeout(this.statsTimer);
    try {
      this.statsStore?.set('blocked', this.lifetime);
    } catch {
      /* Statistics are best-effort. */
    }
  }
}
