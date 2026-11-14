import type Store from 'electron-store';
import { isWebURL } from '../shared/navigation';

export interface Essential {
  id: string;
  url: string;
  title: string;
}

// The profile's Essentials. Every window shows each one as a pinned tab, and
// they outlast restarts and closed windows until the user unpins them.
export class Essentials {
  list: Essential[] = [];
  private store: Store<{ essentials: unknown }> | null = null;
  constructor(private changed: () => void) {}
  async load() {
    try {
      const { default: ElectronStore } = await import('electron-store');
      const store = new ElectronStore<{ essentials: unknown }>({
        name: 'essentials',
      });
      const raw = store.get('essentials');
      if (Array.isArray(raw)) this.list = raw.filter(valid).slice(0, 50);
      this.store = store;
    } catch {
      // Without storage they still work, for this run only.
    }
  }
  add(essential: Essential) {
    if (!valid(essential) || this.list.some((e) => e.id === essential.id))
      return false;
    this.list = [
      ...this.list,
      { ...essential, title: essential.title.slice(0, 1024) },
    ];
    this.save();
    return true;
  }
  remove(id: string) {
    if (!this.list.some((e) => e.id === id)) return;
    this.list = this.list.filter((e) => e.id !== id);
    this.save();
  }
  private save() {
    try {
      this.store?.set('essentials', this.list);
    } catch {
      /* Kept for this run; the next change tries again. */
    }
    this.changed();
  }
}

function valid(value: unknown): value is Essential {
  const v = value as Essential;
  return (
    !!v &&
    typeof v.id === 'string' &&
    /^[a-z\d-]{1,80}$/i.test(v.id) &&
    typeof v.url === 'string' &&
    isWebURL(v.url) &&
    typeof v.title === 'string'
  );
}
