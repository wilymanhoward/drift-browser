import { WebContentsView } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';
import type { TabCardAnchor, TabState } from '../shared/browser';

export interface TabCardDetails extends TabState {
  description: string;
  snapshot: string | null;
  active: boolean;
  lastActive: number;
}
const WIDTH = 288;
// Room around the card for its shadow. The side facing the sidebar stays thin
// so the view never covers the tab the cursor is on.
const NEAR = 4;
const FAR = 30;
const TOP = 8;
const BOTTOM = 38;
const GAP = 6;

// Reads the page's own summary in an isolated world, so page scripts cannot
// reach Drift and only a trimmed string comes back.
export async function readDescription(page: WebContents) {
  try {
    const value: unknown = await Promise.race([
      page.executeJavaScriptInIsolatedWorld(1999, [
        {
          code: `(() => {
            const pick = (s) => document.querySelector(s)?.getAttribute('content') || '';
            return (pick('meta[name="description" i]') || pick('meta[property="og:description"]') || pick('meta[name="twitter:description" i]')).replace(/\\s+/g, ' ').trim().slice(0, 320);
          })()`,
        },
      ]),
      new Promise((resolve) => setTimeout(resolve, 400, null)),
    ]);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}
// A small JPEG of the page; background tabs are captured without being shown.
export async function readSnapshot(page: WebContents) {
  try {
    const image = await page.capturePage(undefined, { stayHidden: true });
    if (image.isEmpty()) return null;
    const jpeg = image.resize({ width: WIDTH * 2, quality: 'good' }).toJPEG(72);
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

// The card is its own transparent view, because native page views cover the
// renderer and an element there could never sit over the page.
const CARD_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style id="theme"></style><style>
*{box-sizing:border-box}
html,body{margin:0;background:transparent;overflow:hidden}
body{font:12px/1.35 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter Variable','Segoe UI Variable Text','Segoe UI',system-ui,sans-serif;letter-spacing:-.005em;color:var(--text);-webkit-font-smoothing:antialiased;font-synthesis:none;padding:${TOP}px ${FAR}px ${BOTTOM}px ${NEAR}px;user-select:none;cursor:default}
body.right{padding:${TOP}px ${NEAR}px ${BOTTOM}px ${FAR}px}
.card{width:${WIDTH}px;padding:6px;border-radius:var(--radius);background:var(--surface);border:.5px solid var(--hairline);box-shadow:inset 0 .5px 0 var(--glass-edge),0 1px 2px #0000001a,0 8px 22px #1e14502e;overflow:hidden}
body.dark .card{box-shadow:inset 0 .5px 0 #ffffff1a,0 1px 2px #00000066,0 8px 22px #0000008c}
.card.enter{animation:enter 140ms cubic-bezier(.33,1,.68,1)}
body.right .card.enter{animation-name:enter-right}
@keyframes enter{from{opacity:0;transform:translateX(-4px) scale(.98)}}
@keyframes enter-right{from{opacity:0;transform:translateX(4px) scale(.98)}}
@media (prefers-reduced-motion:reduce){.card.enter{animation:none}}
.shot{display:block;width:100%;aspect-ratio:16/9;border-radius:calc(var(--radius) - 6px);background:var(--input-bg) center top/cover no-repeat;border:.5px solid var(--hairline)}
.body{padding:8px 6px 4px;display:grid;gap:4px}
.site{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;min-width:0}
.site img,.site .dot{width:14px;height:14px;flex:none;border-radius:4px}
.site .dot{display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--icon-accent);font-size:9px;font-weight:700;text-transform:uppercase}
.site span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chips{margin-left:auto;display:flex;gap:4px;flex:none}
.chip{padding:1px 6px;border-radius:999px;background:var(--input-bg);color:var(--muted);font-size:10.5px;font-weight:500}
.chip.accent{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--icon-accent)}
.chip.error{background:color-mix(in srgb,var(--error) 14%,transparent);color:var(--error)}
.title{font-size:13px;font-weight:600;line-height:1.3;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.desc{color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.desc.error{color:var(--error)}
.foot{display:flex;gap:8px;color:var(--muted);font-size:11px;padding-top:2px;border-top:.5px solid var(--hairline);margin-top:2px;padding-top:6px}
.foot .url{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr}
.foot .when{flex:none;font-variant-numeric:tabular-nums}
</style></head><body><div class="card" id="card"></div><script>
const dot = (d) => el('span', 'dot', (d.site || '?').slice(0, 1));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
window.render = (d) => {
  document.getElementById('theme').textContent = d.theme;
  document.body.classList.toggle('right', d.side === 'right');
  document.body.classList.toggle('dark', d.dark);
  const card = document.getElementById('card');
  card.replaceChildren();
  if (d.snapshot) { const shot = el('div', 'shot'); shot.style.backgroundImage = 'url("' + d.snapshot + '")'; card.append(shot); }
  const body = el('div', 'body');
  const site = el('div', 'site');
  if (d.favicon) { const icon = el('img'); icon.alt = ''; icon.referrerPolicy = 'no-referrer'; icon.src = d.favicon; icon.onerror = () => icon.replaceWith(dot(d)); site.append(icon); }
  else site.append(dot(d));
  site.append(el('span', '', d.site));
  const chips = el('div', 'chips');
  for (const [label, kind] of d.chips) chips.append(el('span', 'chip ' + kind, label));
  site.append(chips);
  body.append(site, el('div', 'title', d.title));
  if (d.error) body.append(el('div', 'desc error', d.error));
  else if (d.description) body.append(el('div', 'desc', d.description));
  if (d.url || d.when) { const foot = el('div', 'foot'); foot.append(el('span', 'url', d.url), el('span', 'when', d.when)); body.append(foot); }
  card.append(body);
  card.classList.remove('enter');
  if (d.animate) { void card.offsetWidth; card.classList.add('enter'); }
  return Math.ceil(card.getBoundingClientRect().height);
};
</script></body></html>`;

function ago(time: number) {
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

// The hover card beside a sidebar tab: preview, site, title, the page's own
// description and the tab's state.
export class TabCard {
  private view: WebContentsView | null = null;
  private loaded: Promise<unknown> | null = null;
  private version = 0;
  private shown: string | null = null;
  constructor(
    private win: BrowserWindow,
    private partition: string,
    private theme: () => { css: string; dark: boolean },
    private side: () => 'left' | 'right',
  ) {}
  get tabId() {
    return this.shown;
  }
  private ensure() {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        // Favicons load from the same session as the tab, so private windows stay private.
        partition: this.partition,
      },
    });
    view.setBackgroundColor('#00000000');
    view.setVisible(false);
    const page = view.webContents;
    page.setWindowOpenHandler(() => ({ action: 'deny' }));
    page.on('will-navigate', (event) => event.preventDefault());
    this.loaded = page
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(CARD_HTML)}`)
      .catch(() => undefined);
    this.view = view;
    return view;
  }
  async show(
    anchor: TabCardAnchor,
    details: () => Promise<TabCardDetails | null>,
  ) {
    const version = ++this.version;
    const view = this.ensure();
    const [tab] = await Promise.all([details(), this.loaded]);
    if (version !== this.version || this.win.isDestroyed()) return;
    if (!tab) {
      this.hide();
      return;
    }
    const side = this.side();
    let site = tab.url;
    try {
      site = new URL(tab.url).hostname.replace(/^www\./, '') || tab.url;
    } catch {
      /* Keeps the raw address. */
    }
    const internal = !/^https?:/i.test(tab.url);
    const chips: [string, string][] = [];
    if (tab.active) chips.push(['Current', 'accent']);
    if (tab.loading) chips.push(['Loading', '']);
    if (tab.unloaded) chips.push(['Sleeping', '']);
    if (tab.muted) chips.push(['Muted', '']);
    else if (tab.audible) chips.push(['Playing', 'accent']);
    if (tab.error) chips.push(['Error', 'error']);
    const { css, dark } = this.theme();
    const payload = {
      theme: css,
      dark,
      side,
      animate: this.shown === null,
      snapshot: tab.snapshot,
      favicon: tab.favicon,
      site: internal ? 'Drift' : site,
      title: tab.title || (internal ? 'New tab' : tab.url),
      description: tab.description,
      error: tab.error,
      chips,
      url: internal ? '' : tab.url.replace(/^https?:\/\//, ''),
      when: tab.active ? '' : ago(tab.lastActive),
    };
    let height: unknown;
    try {
      height = await view.webContents.executeJavaScript(
        `window.render(${JSON.stringify(payload)})`,
      );
    } catch {
      return;
    }
    if (version !== this.version || this.win.isDestroyed()) return;
    const [width, windowHeight] = this.win.getContentSize();
    const total = WIDTH + NEAR + FAR;
    const tall = Math.min(
      windowHeight,
      (typeof height === 'number' ? height : 160) + TOP + BOTTOM,
    );
    const x =
      side === 'left'
        ? anchor.edge + GAP - NEAR
        : anchor.edge - GAP + NEAR - total;
    const y = Math.max(0, Math.min(anchor.top - TOP, windowHeight - tall));
    view.setBounds({
      x: Math.max(0, Math.min(Math.round(x), width - total)),
      y: Math.round(y),
      width: total,
      height: tall,
    });
    // Adding it again brings it above pages opened since.
    this.win.contentView.addChildView(view);
    view.setVisible(true);
    this.shown = tab.id;
  }
  hide() {
    ++this.version;
    this.shown = null;
    if (this.view && !this.view.webContents.isDestroyed())
      this.view.setVisible(false);
  }
  dispose() {
    ++this.version;
    if (this.view && !this.view.webContents.isDestroyed())
      this.view.webContents.close();
    this.view = null;
  }
}
