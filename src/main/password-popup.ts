import { WebContentsView } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';

const WIDTH = 296;
// Room around the card for its shadow.
const PAD = 14;

// Drift's own sign-in panels: the account picker under a login field and the
// save prompt at the top of the page. Like the tab card, it is a transparent
// view of its own, since nothing in the renderer can sit over a page.
const POPUP_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style id="theme"></style><style>
*{box-sizing:border-box}
html,body{margin:0;background:transparent;overflow:hidden}
body{font:13px/1.35 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter Variable','Segoe UI Variable Text','Segoe UI',system-ui,sans-serif;letter-spacing:-.005em;color:var(--text);-webkit-font-smoothing:antialiased;font-synthesis:none;padding:${PAD}px;user-select:none;cursor:default}
.card{width:${WIDTH}px;padding:6px;border-radius:var(--radius);background:var(--surface);border:.5px solid var(--hairline);box-shadow:inset 0 .5px 0 var(--glass-edge),0 1px 2px #0000001a,0 8px 22px #1e14502e;animation:enter 140ms cubic-bezier(.33,1,.68,1)}
body.dark .card{box-shadow:inset 0 .5px 0 #ffffff1a,0 1px 2px #00000066,0 8px 22px #0000008c}
@keyframes enter{from{opacity:0;transform:translateY(-4px) scale(.98)}}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
.head{display:flex;align-items:center;gap:6px;padding:4px 6px 6px;color:var(--muted);font-size:11px;font-weight:500}
.head svg{flex:none;color:var(--icon-accent)}
.head span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{font:inherit;color:inherit;border:0;margin:0;cursor:default}
button:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 75%,transparent);outline-offset:-2px}
.row{display:flex;align-items:center;gap:10px;width:100%;padding:7px 8px;border-radius:calc(var(--radius) - 4px);background:transparent;text-align:left}
.row:hover,.row:focus-visible{background:var(--hover)}
.avatar{display:grid;place-items:center;width:26px;height:26px;flex:none;border-radius:50%;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--icon-accent);font-size:12px;font-weight:700;text-transform:uppercase}
.who{display:grid;min-width:0}
.name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dots{color:var(--muted);font-size:11px;letter-spacing:.12em}
.save{padding:6px 8px 4px;display:grid;gap:10px}
.title{font-size:14px;font-weight:600}
.site{color:var(--muted);font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.login{display:flex;align-items:center;gap:10px;padding:8px;border-radius:calc(var(--radius) - 4px);background:var(--input-bg)}
.actions{display:flex;align-items:center;gap:8px}
.actions .never{margin-right:auto;padding:5px 4px;background:transparent;color:var(--muted);font-size:12px}
.actions .never:hover{color:var(--text)}
.text-button{min-height:30px;padding:5px 12px;border-radius:8px;background:var(--input-bg);font-weight:500;white-space:nowrap}
.text-button:hover{background:color-mix(in srgb,var(--input-bg),var(--text) 6%)}
.primary{padding:5px 14px;background:var(--accent);color:var(--accent-text);font-weight:600}
.primary:hover{background:color-mix(in srgb,var(--accent),#000 12%)}
</style></head><body class="fill"><div class="card" id="card"></div><script>
const KEY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
let pick = null;
const choose = (value) => { const done = pick; pick = null; if (done) done(value); };
window.choice = () => new Promise((resolve) => { pick = resolve; });
const login = (name, cls) => { const row = el(cls === 'row' ? 'button' : 'div', cls); const who = el('span', 'who'); who.append(el('span', 'name', name || 'No username'), el('span', 'dots', '••••••••')); row.append(el('span', 'avatar', (name || '?').slice(0, 1)), who); return row; };
window.render = (d) => {
  choose(-1);
  document.getElementById('theme').textContent = d.theme;
  document.body.classList.toggle('dark', d.dark);
  const card = document.getElementById('card');
  card.replaceChildren();
  if (d.mode === 'fill') {
    const head = el('div', 'head'); head.innerHTML = KEY; head.append(el('span', '', 'Saved passwords for ' + d.site));
    card.append(head);
    d.usernames.forEach((name, i) => { const row = login(name, 'row'); row.onclick = () => choose(i); card.append(row); });
  } else {
    const save = el('div', 'save');
    const text = el('div'); text.append(el('div', 'title', d.update ? 'Update saved password?' : 'Save password?'), el('div', 'site', d.site));
    const actions = el('div', 'actions');
    [['Never for this site', 'never', 2], ['Not now', 'text-button', 1], [d.update ? 'Update' : 'Save', 'text-button primary', 0]].forEach(([label, cls, value]) => { const b = el('button', cls, label); b.onclick = () => choose(value); actions.append(b); });
    save.append(text, login(d.username, 'login'), actions);
    card.append(save);
  }
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  return Math.ceil(card.getBoundingClientRect().height);
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return choose(-1);
  const rows = [...document.querySelectorAll('button')];
  const at = rows.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[(at + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus(); }
});
</script></body></html>`;

export type PopupRequest =
  | { mode: 'fill'; site: string; usernames: string[] }
  | { mode: 'save'; site: string; username: string; update: boolean };
// A field's box in the page, in CSS pixels from the viewport's corner.
export interface FieldRect {
  left: number;
  top: number;
  bottom: number;
}

export class PasswordPopup {
  private view: WebContentsView | null = null;
  private loaded: Promise<unknown> | null = null;
  private cancel: (() => void) | null = null;
  private mode: PopupRequest['mode'] | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private win: BrowserWindow) {}
  private ensure() {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    view.setBackgroundColor('#00000000');
    view.setVisible(false);
    const page = view.webContents;
    page.setWindowOpenHandler(() => ({ action: 'deny' }));
    page.on('will-navigate', (event) => event.preventDefault());
    // The picker closes when you click away, like a menu.
    page.on('blur', () => {
      if (this.mode === 'fill') this.cancel?.();
    });
    this.loaded = page
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(POPUP_HTML)}`)
      .catch(() => undefined);
    this.view = view;
    return view;
  }
  // Resolves with the picked row or button index, or null when dismissed.
  async ask(
    request: PopupRequest,
    page: WebContents,
    theme: { css: string; dark: boolean },
    field?: FieldRect,
  ): Promise<number | null> {
    this.cancel?.();
    const view = this.ensure();
    await this.loaded;
    if (this.win.isDestroyed() || page.isDestroyed()) return null;
    let height: unknown;
    try {
      height = await view.webContents.executeJavaScript(
        `window.render(${JSON.stringify({ ...request, theme: theme.css, dark: theme.dark })})`,
      );
    } catch {
      return null;
    }
    if (this.win.isDestroyed() || page.isDestroyed()) return null;
    const tab = this.win.contentView.children.find(
      (child) => child instanceof WebContentsView && child.webContents === page,
    );
    const [winWidth, winHeight] = this.win.getContentSize();
    const area = tab?.getBounds() ?? {
      x: 0,
      y: 0,
      width: winWidth,
      height: winHeight,
    };
    const total = WIDTH + PAD * 2;
    const tall = (typeof height === 'number' ? height : 120) + PAD * 2;
    let x = area.x + area.width - total + PAD - 12;
    let y = area.y + 8 - PAD;
    if (field) {
      const zoom = page.getZoomFactor();
      x = area.x + field.left * zoom - PAD;
      y = area.y + field.bottom * zoom + 4 - PAD;
      // Opens above the field when there is no room below it.
      if (y + tall > area.y + area.height)
        y = area.y + field.top * zoom - 4 - tall + PAD;
    }
    view.setBounds({
      x: Math.round(Math.max(0, Math.min(x, winWidth - total))),
      y: Math.round(Math.max(0, Math.min(y, winHeight - tall))),
      width: total,
      height: tall,
    });
    // Adding it again brings it above pages opened since.
    this.win.contentView.addChildView(view);
    view.setVisible(true);
    this.mode = request.mode;
    // The picker takes keyboard focus; the save prompt never interrupts typing.
    if (request.mode === 'fill') view.webContents.focus();
    return new Promise((resolve) => {
      const done = (value: number | null) => {
        if (this.cancel !== cancel) return;
        this.cancel = null;
        page.removeListener('destroyed', cancel);
        this.hide();
        resolve(value);
      };
      const cancel = () => done(null);
      this.cancel = cancel;
      clearTimeout(this.timer);
      if (request.mode === 'save') this.timer = setTimeout(cancel, 30000);
      page.once('destroyed', cancel);
      view.webContents
        .executeJavaScript('window.choice()')
        .then(
          (value: unknown) =>
            done(typeof value === 'number' && value >= 0 ? value : null),
          cancel,
        );
    });
  }
  private hide() {
    clearTimeout(this.timer);
    this.mode = null;
    if (this.view && !this.view.webContents.isDestroyed())
      this.view.setVisible(false);
  }
}
