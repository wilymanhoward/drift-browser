import { app, dialog, nativeImage, session as sessions } from 'electron';
import type {
  BaseWindow,
  BrowserWindow,
  ContextMenuParams,
  Extension,
  MenuItem,
  Session,
  WebContents,
} from 'electron';
import type Store from 'electron-store';
import path from 'node:path';
import { mkdtemp, readFile, mkdir, rename, rm } from 'node:fs/promises';
import { ElectronChromeExtensions } from 'electron-chrome-extensions';
import {
  installChromeWebStore,
  uninstallExtension,
  downloadExtension,
} from 'electron-chrome-web-store';
import { WEB_STORE_URL } from '../shared/extensions';
import type {
  ExtensionCommand,
  ExtensionInfo,
  ExtensionsState,
} from '../shared/extensions';

// How the profile's windows open, focus and close tabs for extensions.
export interface ExtensionTabs {
  open(
    url: string,
    active: boolean,
    windowId?: number,
  ): [WebContents, BrowserWindow];
  select(page: WebContents): void;
  close(page: WebContents): void;
  window(): BrowserWindow | undefined;
}
interface Manifest {
  description?: string;
  icons?: Record<string, string>;
  action?: unknown;
  browser_action?: unknown;
  options_page?: string;
  options_ui?: { page?: string };
}
// The library's popup, which its package does not export a type for.
interface PopupView {
  browserWindow?: BrowserWindow;
  whenReady(): Promise<void>;
  isDestroyed(): boolean;
  setSize(size: { width: number; height: number }): void;
}
let crxProtocol = false;

// Chrome Web Store installs and the chrome.* APIs Electron lacks (tabs,
// action popups, context menus), for the persistent profile only: Chromium
// does not run extensions in in-memory sessions.
export class Extensions {
  error: string | null = null;
  private api: ElectronChromeExtensions | null = null;
  private store: Store<{ hidden: unknown }> | null = null;
  private hidden: string[] = [];
  // The library reports its own bookkeeping through the same callbacks as
  // extension requests, so Drift's calls into it are muted.
  private quiet = false;
  private cached: ExtensionsState | null = null;
  private readonly path = path.join(app.getPath('userData'), 'Extensions');
  constructor(
    private session: Session,
    private tabs: ExtensionTabs,
    private notify: () => void,
  ) {}
  // Icons are decoded once per change, not on every state publish.
  private changed = () => {
    this.cached = null;
    this.notify();
  };
  async load() {
    if (!crxProtocol) {
      crxProtocol = true;
      // Toolbar icons are drawn by the chrome UI, which lives in the default session.
      ElectronChromeExtensions.handleCRXProtocol(sessions.defaultSession);
    }
    try {
      const { default: ElectronStore } = await import('electron-store');
      this.store = new ElectronStore<{ hidden: unknown }>({
        name: 'extensions',
      });
      const hidden = this.store.get('hidden');
      if (Array.isArray(hidden))
        this.hidden = hidden.filter((id) => typeof id === 'string');
    } catch {
      this.store = null;
    }
    this.api = new ElectronChromeExtensions({
      license: 'GPL-3.0',
      session: this.session,
      createTab: async (details) => {
        const [page, win] = this.tabs.open(
          details.url || WEB_STORE_URL,
          details.active !== false,
          details.windowId,
        );
        return [page, win];
      },
      selectTab: (page) => {
        if (!this.quiet) this.tabs.select(page);
      },
      removeTab: (page) => {
        if (!this.quiet && !page.isDestroyed()) this.tabs.close(page);
      },
    });
    this.api.on(
      'browser-action-popup-created',
      (popup: PopupView) => void this.revealPopup(popup),
    );
    this.session.extensions.on('extension-loaded', this.changed);
    this.session.extensions.on('extension-unloaded', this.changed);
    try {
      await installChromeWebStore({
        session: this.session,
        extensionsPath: this.path,
        beforeInstall: (details) => this.confirmInstall(details),
      });
    } catch (error) {
      console.error('Extensions could not be loaded:', error);
      this.error = 'Some extensions could not be loaded.';
    }
  }
  // Popups size themselves from Chromium's preferred-size events, which some
  // setups never send for a hidden window; measure the page instead.
  private async revealPopup(popup: PopupView) {
    await popup.whenReady();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const win = popup.browserWindow;
    if (popup.isDestroyed() || !win || win.isDestroyed() || win.isVisible())
      return;
    try {
      const size = (await win.webContents.executeJavaScript(
        '({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })',
      )) as { width: number; height: number };
      if (popup.isDestroyed()) return;
      popup.setSize(size);
      const hidden = popup as unknown as {
        updatePosition(): void;
        show(): void;
      };
      hidden.updatePosition();
      hidden.show();
    } catch {
      /* The popup closed while it was measured. */
    }
  }
  private mute(work: () => void) {
    this.quiet = true;
    try {
      work();
    } finally {
      this.quiet = false;
    }
  }
  // Returns a cleanup for when the page moves to another window.
  track(page: WebContents, win: BaseWindow) {
    const api = this.api;
    if (!api) return () => {};
    this.mute(() => api.addTab(page, win));
    return () => {
      if (!page.isDestroyed()) this.mute(() => api.removeTab(page));
    };
  }
  activate(page: WebContents) {
    const api = this.api;
    if (api && !page.isDestroyed()) this.mute(() => api.selectTab(page));
  }
  menuItems(page: WebContents, params: ContextMenuParams): MenuItem[] {
    if (!this.api || page.isDestroyed()) return [];
    try {
      return this.api.getContextMenuItems(page, params);
    } catch {
      return [];
    }
  }
  get state(): ExtensionsState {
    this.cached ??= {
      available: !!this.api,
      error: this.error,
      extensions: this.session.extensions
        .getAllExtensions()
        .map((extension) => this.info(extension))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    return this.cached;
  }
  private info(extension: Extension): ExtensionInfo {
    const manifest = extension.manifest as Manifest;
    const sizes = Object.keys(manifest.icons ?? {})
      .map(Number)
      .sort((a, b) => Math.abs(a - 48) - Math.abs(b - 48));
    let icon: string | null = null;
    if (sizes.length) {
      const file = path.resolve(
        extension.path,
        manifest.icons![String(sizes[0])],
      );
      // Icons are read only from inside the extension's own folder.
      if (file.startsWith(path.resolve(extension.path) + path.sep)) {
        const image = nativeImage.createFromPath(file);
        if (!image.isEmpty())
          icon = image.resize({ width: 32, height: 32 }).toDataURL();
      }
    }
    return {
      id: extension.id,
      name: extension.name,
      version: extension.version,
      description: manifest.description ?? '',
      icon,
      hasOptions: !!(manifest.options_ui?.page || manifest.options_page),
      hasAction: !!(manifest.action || manifest.browser_action),
      hidden: this.hidden.includes(extension.id),
    };
  }
  async command(command: ExtensionCommand) {
    if (command.type === 'store') {
      this.tabs.open(WEB_STORE_URL, true);
      return;
    }
    const extension = this.session.extensions.getExtension(command.id);
    if (!extension) throw new Error('Unknown extension.');
    if (command.type === 'options') {
      const manifest = extension.manifest as Manifest;
      const page = manifest.options_ui?.page || manifest.options_page;
      if (!page) throw new Error('This extension has no options.');
      this.tabs.open(new URL(page, extension.url).href, true);
    } else if (command.type === 'toggle-toolbar') {
      this.hidden = this.hidden.includes(command.id)
        ? this.hidden.filter((id) => id !== command.id)
        : [...this.hidden, command.id];
      this.store?.set('hidden', this.hidden);
      this.changed();
    } else {
      const win = this.tabs.window();
      const options = {
        type: 'question' as const,
        message: `Remove “${extension.name}” from Drift?`,
        detail: 'Its settings and saved data are deleted.',
        buttons: ['Cancel', 'Remove'],
        defaultId: 1,
        cancelId: 0,
        noLink: true,
      };
      const { response } = await (win
        ? dialog.showMessageBox(win, options)
        : dialog.showMessageBox(options));
      if (response !== 1) return;
      await uninstallExtension(command.id, {
        session: this.session,
        extensionsPath: this.path,
      });
      this.hidden = this.hidden.filter((id) => id !== command.id);
      this.store?.set('hidden', this.hidden);
      this.changed();
    }
  }
  async importFromStore(
    id: string,
    win: BrowserWindow,
    displayName = id,
  ): Promise<boolean> {
    if (!/^[a-p]{32}$/.test(id)) throw new Error('Invalid extension id.');
    if (this.session.extensions.getExtension(id)) return false;
    if (!this.api) throw new Error('Extensions are unavailable.');
    const temp = path.resolve(app.getPath('userData'), 'Import Staging');
    await mkdir(temp, { recursive: true });
    const staging = await mkdtemp(path.join(temp, 'drift-extension-import-'));
    let destination: string | undefined;
    let loaded = false;
    try {
      const downloaded = path.resolve(await downloadExtension(id, staging));
      if (!downloaded.startsWith(staging + path.sep))
        throw new Error('Invalid extension download.');
      const manifest = JSON.parse(
        await readFile(path.join(downloaded, 'manifest.json'), 'utf8'),
      ) as Manifest & {
        name?: string;
        permissions?: unknown;
        host_permissions?: unknown;
      };
      const confirmation = await this.confirmInstall({
        localizedName: manifest.name?.startsWith('__MSG_')
          ? displayName
          : manifest.name || displayName,
        manifest,
        icon: nativeImage.createEmpty(),
        browserWindow: win,
      });
      if (confirmation.action !== 'allow') return false;
      const parent = path.resolve(this.path, id);
      const target = path.resolve(parent, path.basename(downloaded));
      if (!target.startsWith(parent + path.sep))
        throw new Error('Invalid extension path.');
      await mkdir(parent, { recursive: true });
      await rename(downloaded, target);
      destination = target;
      const extension = await this.session.extensions.loadExtension(
        destination,
        { allowFileAccess: false },
      );
      if (extension.id !== id) {
        this.session.extensions.removeExtension(extension.id);
        throw new Error('Extension identity did not match its store listing.');
      }
      loaded = true;
      if (
        (
          manifest as {
            manifest_version?: number;
            background?: { service_worker?: string };
          }
        ).manifest_version === 3 &&
        (manifest as { background?: { service_worker?: string } }).background
          ?.service_worker
      )
        await this.session.serviceWorkers
          .startWorkerForScope(`chrome-extension://${extension.id}`)
          .catch(() => {
            this.error =
              'An imported extension background worker could not start.';
          });
      this.changed();
      return true;
    } finally {
      // Only remove this operation's staging directory and newly moved package.
      if (
        destination &&
        !loaded &&
        destination.startsWith(path.resolve(this.path, id) + path.sep)
      )
        await rm(destination, { recursive: true, force: true });
      if (
        path.dirname(staging) === temp &&
        path.basename(staging).startsWith('drift-extension-import-')
      )
        await rm(staging, { recursive: true, force: true });
    }
  }
  private async confirmInstall(details: {
    localizedName: string;
    manifest: { permissions?: unknown; host_permissions?: unknown };
    icon: Electron.NativeImage;
    browserWindow?: BrowserWindow;
  }): Promise<{ action: 'allow' | 'deny' }> {
    const list = (value: unknown) =>
      Array.isArray(value) ? value.map(String) : [];
    const permissions = [
      ...list(details.manifest.permissions),
      ...list(details.manifest.host_permissions),
    ];
    const options = {
      type: 'question' as const,
      icon: details.icon.isEmpty() ? undefined : details.icon,
      title: 'Add extension',
      message: `Add “${details.localizedName}” to Drift?`,
      detail: permissions.length
        ? `It asks for: ${permissions.join(', ')}.\n\nSome Chrome features are not available in Drift, so a few extensions may not work fully.`
        : 'Some Chrome features are not available in Drift, so a few extensions may not work fully.',
      buttons: ['Cancel', 'Add extension'],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
    };
    const win = details.browserWindow ?? this.tabs.window();
    const { response } = await (win
      ? dialog.showMessageBox(win, options)
      : dialog.showMessageBox(options));
    return { action: response === 1 ? 'allow' : 'deny' };
  }
}
