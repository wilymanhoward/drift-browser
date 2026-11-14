import type Store from 'electron-store';
import { isWebURL } from '../shared/navigation';

const ICON = /^data:image\/[\w.+-]+;base64,[a-z\d+/]+=*$/i;
const ICON_LIMIT = 16 * 1024;
const MAX_SITES = 300;

// Site icons by origin, kept between runs so sleeping tabs, Essentials and
// new tab tiles can show a site's own icon before the site is open.
export class SiteIcons {
  private icons = new Map<string, string>();
  private store: Store<{ icons: unknown }> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  async load() {
    try {
      const { default: ElectronStore } = await import('electron-store');
      const store = new ElectronStore<{ icons: unknown }>({
        name: 'site-icons',
      });
      const raw = store.get('icons');
      if (raw && typeof raw === 'object' && !Array.isArray(raw))
        for (const [origin, icon] of Object.entries(raw))
          if (isWebURL(origin) && valid(icon)) this.icons.set(origin, icon);
      this.store = store;
    } catch {
      // Icons are a nicety: without storage they last for this run only.
    }
  }
  get(url: string): string | null {
    const origin = originOf(url);
    return (origin && this.icons.get(origin)) || null;
  }
  set(url: string, icon: string) {
    const origin = originOf(url);
    if (!origin || !valid(icon) || this.icons.get(origin) === icon) return;
    this.icons.delete(origin);
    this.icons.set(origin, icon);
    // The least recently learned icons go first.
    for (const old of [...this.icons.keys()].slice(
      0,
      Math.max(0, this.icons.size - MAX_SITES),
    ))
      this.icons.delete(old);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1000);
  }
  // Which sites were open is browsing data, so it goes when history does.
  clear() {
    this.icons.clear();
    this.flush();
  }
  flush() {
    clearTimeout(this.timer);
    try {
      this.store?.set('icons', Object.fromEntries(this.icons));
    } catch {
      /* Kept in memory; saving is retried with the next new icon. */
    }
  }
}

function valid(icon: unknown): icon is string {
  return (
    typeof icon === 'string' && icon.length <= ICON_LIMIT && ICON.test(icon)
  );
}

function originOf(url: string): string | null {
  return isWebURL(url) ? new URL(url).origin : null;
}
