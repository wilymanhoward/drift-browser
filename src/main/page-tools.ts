import { Menu, clipboard } from 'electron';
import type {
  BrowserWindow,
  ContextMenuParams,
  MenuItem,
  WebContents,
  MenuItemConstructorOptions,
} from 'electron';
import type Store from 'electron-store';
import { isWebURL } from '../shared/navigation';
import { listeners } from './listeners';
import { parseZoom, zoomOrigin } from '../shared/page-tools';
import type { FindState, FindCommand, PageAction } from '../shared/page-tools';
export class PageTools {
  find: FindState | null = null;
  error: string | null = null;
  // Items extensions add through chrome.contextMenus.
  extraItems: (page: WebContents, params: ContextMenuParams) => MenuItem[] =
    () => [];
  private target: WebContents | null = null;
  private request = 0;
  private zoom: Record<string, number> = {};
  private store: Store<{ zoom: unknown }> | null = null;
  constructor(
    private win: BrowserWindow,
    private active: () => WebContents,
    private open: (url: string) => void,
    private changed: () => void,
  ) {}
  async load(privateWindow: boolean) {
    try {
      const { default: Store } = await import('electron-store');
      const store = new Store<{ zoom: unknown }>({ name: 'zoom' });
      const saved = store.get('zoom');
      if (saved !== undefined) this.zoom = parseZoom(saved);
      if (!privateWindow) this.store = store;
    } catch {
      this.error =
        'Zoom preferences could not be read. The original file is preserved.';
    }
  }
  // Returns a cleanup for when the page moves to another window.
  attach(page: WebContents) {
    const { on, off } = listeners(page);
    on('did-navigate', () => this.applyZoom(page));
    on('did-navigate-in-page', () => this.applyZoom(page));
    on('found-in-page', (_event, result) => {
      if (
        this.target === page &&
        this.find &&
        result.requestId === this.request
      ) {
        this.find = {
          ...this.find,
          matches: result.matches,
          active: result.activeMatchOrdinal,
        };
        this.changed();
      }
    });
    on('did-start-navigation', (_event, _url, inPlace, main) => {
      if (main && !inPlace && this.target === page) this.closeFind();
    });
    on('destroyed', () => {
      if (this.target === page) {
        this.target = null;
        this.find = null;
      }
    });
    on('context-menu', (_event, p) => {
      const items: (MenuItemConstructorOptions | MenuItem)[] = [];
      if (isWebURL(p.linkURL))
        items.push(
          { label: 'Open link in new tab', click: () => this.open(p.linkURL) },
          {
            label: 'Copy link address',
            click: () => clipboard.writeText(p.linkURL),
          },
        );
      if (p.mediaType === 'image' && isWebURL(p.srcURL))
        items.push({
          label: 'Save image as…',
          click: () => page.downloadURL(p.srcURL),
        });
      if (p.isEditable)
        items.push(
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        );
      else if (p.selectionText)
        items.push({
          label: 'Copy',
          click: () => clipboard.writeText(p.selectionText),
        });
      if (items.length) items.push({ type: 'separator' });
      const extra = this.extraItems(page, p);
      if (extra.length) items.push(...extra, { type: 'separator' });
      items.push(
        { label: 'Find in page', click: () => this.action('find') },
        {
          label: 'Print…',
          click: () =>
            page.print({ silent: false }, (ok, reason) => {
              if (!ok && reason !== 'cancelled') {
                this.error = `Print did not complete: ${reason}`;
                this.changed();
              }
            }),
        },
        {
          label: 'Inspect element',
          click: () => page.inspectElement(p.x, p.y),
        },
      );
      Menu.buildFromTemplate(items).popup({ window: this.win });
    });
    return off;
  }
  private applyZoom(page: WebContents) {
    const origin = zoomOrigin(page.getURL());
    page.setZoomFactor(origin ? (this.zoom[origin] ?? 1) : 1);
    this.changed();
  }
  closeFind() {
    if (!this.find && !this.target) return;
    if (this.target && !this.target.isDestroyed())
      this.target.stopFindInPage('clearSelection');
    this.target = null;
    this.find = null;
    this.request = 0;
    this.changed();
  }
  findCommand(command: FindCommand) {
    if (command.type === 'close') {
      this.closeFind();
      this.active().focus();
      return;
    }
    if (!this.find || !this.target || this.target.isDestroyed())
      throw new Error('Find is not open');
    if (command.type === 'query') {
      this.find = { query: command.query, matches: 0, active: 0 };
      this.target.stopFindInPage('clearSelection');
      this.request = command.query
        ? this.target.findInPage(command.query, { findNext: false })
        : 0;
    } else if (this.find.query)
      this.request = this.target.findInPage(this.find.query, {
        forward: command.forward,
        findNext: true,
      });
    this.changed();
  }
  action(action: PageAction) {
    const page = this.active();
    if (action === 'find') {
      this.closeFind();
      this.target = page;
      this.find = { query: '', matches: 0, active: 0 };
      this.changed();
      this.win.webContents.focus();
      this.win.webContents.send('drift:find-focus');
    } else if (action === 'print')
      page.print({ silent: false }, (ok, reason) => {
        if (!ok && reason !== 'cancelled') {
          this.error = `Print did not complete: ${reason}`;
          this.changed();
        }
      });
    else if (action === 'fullscreen')
      this.win.setFullScreen(!this.win.isFullScreen());
    else {
      const origin = zoomOrigin(page.getURL());
      const factor =
        action === 'zoom-reset'
          ? 1
          : Math.max(
              0.25,
              Math.min(
                3,
                Math.round(
                  (page.getZoomFactor() + (action === 'zoom-in' ? 0.1 : -0.1)) *
                    100,
                ) / 100,
              ),
            );
      if (origin) {
        const next = { ...this.zoom, [origin]: factor };
        const keys = Object.keys(next);
        if (keys.length > 2000) delete next[keys[0]];
        if (this.store) this.store.set('zoom', next);
        this.zoom = next;
        for (const view of this.win.contentView.children) {
          const target = (view as Electron.WebContentsView).webContents;
          if (
            target &&
            !target.isDestroyed() &&
            zoomOrigin(target.getURL()) === origin
          )
            target.setZoomFactor(factor);
        }
      } else page.setZoomFactor(factor);
      this.changed();
    }
  }
}
