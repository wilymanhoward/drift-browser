import { WebContentsView, app, shell } from 'electron';
import type { BrowserWindow, Rectangle } from 'electron';

const WIDTH = 300;
// Room around the card for its shadow.
const PAD = 14;

// "Download complete", shown under the downloads button like Brave's bubble.
// A transparent view of its own, as the password popup is, since nothing in
// the renderer can sit over a page. The file row drags out as a real file.
const POPUP_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style id="theme"></style><style>
*{box-sizing:border-box}
html,body{margin:0;background:transparent;overflow:hidden}
body{font:13px/1.35 'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;padding:${PAD}px}
.card{width:${WIDTH}px;padding:10px;border-radius:var(--radius);background:var(--surface);border:.5px solid var(--hairline);box-shadow:inset 0 .5px 0 var(--glass-edge),0 1px 2px #0000001a,0 8px 22px #1e14502e;animation:enter .16s ease-out}
body.dark .card{box-shadow:inset 0 .5px 0 #ffffff1a,0 1px 2px #00000066,0 8px 22px #0000008c}
@keyframes enter{from{opacity:0;transform:translateY(-4px) scale(.98)}}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
.head{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-weight:600}
.head svg{flex:none;color:var(--highlight)}
.head span{flex:1}
button{font:inherit;color:inherit;border:0;margin:0;cursor:default;background:transparent}
button:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 75%,transparent);outline-offset:-2px}
.close{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;color:var(--muted)}
.close:hover{background:var(--hover);color:var(--text)}
.file{display:flex;align-items:center;gap:10px;padding:8px;border-radius:calc(var(--radius) - 4px);background:var(--input-bg);cursor:grab}
.file img{width:32px;height:32px;flex:none}
.who{display:grid;min-width:0}
.name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hint{color:var(--muted);font-size:11px}
.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.text-button{min-height:30px;padding:5px 12px;border-radius:8px;background:var(--input-bg);font-weight:500}
.text-button:hover{background:color-mix(in srgb,var(--input-bg),var(--text) 6%)}
</style></head><body><div class="card" role="status">
<div class="head"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>Download complete</span><button class="close" id="close" aria-label="Close">✕</button></div>
<div class="file" id="file" draggable="true" title="Drag into another app or onto a page"><img id="icon" alt=""><span class="who"><span class="name" id="name"></span><span class="hint" id="hint"></span></span></div>
<div class="actions"><button class="text-button" id="open">Open</button><button class="text-button" id="show">Show in folder</button></div>
</div><script>
let pick = null, timer = 0;
const choose = (value) => { clearTimeout(timer); const done = pick; pick = null; if (done) done(value); };
window.choice = () => new Promise((resolve) => { pick = resolve; });
// It goes by itself after a while, but never from under the mouse.
const later = () => { clearTimeout(timer); timer = setTimeout(() => choose('close'), 8000); };
document.body.onmouseenter = () => clearTimeout(timer);
document.body.onmouseleave = later;
document.getElementById('close').onclick = () => choose('close');
document.getElementById('show').onclick = () => choose('show');
document.getElementById('open').onclick = () => choose('open');
document.getElementById('file').ondragstart = (e) => { e.preventDefault(); choose('drag'); };
window.render = (d) => {
  choose('replaced');
  document.getElementById('theme').textContent = d.theme;
  document.body.classList.toggle('dark', d.dark);
  document.getElementById('name').textContent = d.name;
  document.getElementById('hint').textContent = d.size + ' · drag to use it';
  const icon = document.getElementById('icon');
  icon.hidden = !d.icon; if (d.icon) icon.src = d.icon;
  document.getElementById('open').hidden = !d.open;
  const card = document.querySelector('.card');
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  later();
  return Math.ceil(card.getBoundingClientRect().height);
};
</script></body></html>`;

export interface FinishedDownload {
  name: string;
  size: string;
  // The saved file, checked again at use, since it may have moved.
  file: () => string;
  // Offered for files Drift can show itself (PDFs).
  open?: () => void;
}

export class DownloadPopup {
  private view: WebContentsView | null = null;
  private loaded: Promise<unknown> | null = null;
  private current = 0;
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
    this.loaded = page
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(POPUP_HTML)}`)
      .catch(() => undefined);
    this.view = view;
    return view;
  }
  // `anchor` is the downloads button in window coordinates, or null to sit at
  // the top right of the page instead.
  async show(
    download: FinishedDownload,
    anchor: Rectangle | null,
    page: Rectangle,
    theme: { css: string; dark: boolean },
  ) {
    const id = ++this.current;
    const view = this.ensure();
    await this.loaded;
    let icon = '';
    try {
      icon = (
        await app.getFileIcon(download.file(), { size: 'large' })
      ).toDataURL();
    } catch {
      /* The card still shows without an icon. */
    }
    if (id !== this.current || this.win.isDestroyed()) return;
    let height: unknown;
    try {
      height = await view.webContents.executeJavaScript(
        `window.render(${JSON.stringify({ name: download.name, size: download.size, open: !!download.open, icon, theme: theme.css, dark: theme.dark })})`,
      );
    } catch {
      return;
    }
    if (id !== this.current || this.win.isDestroyed()) return;
    const [winWidth, winHeight] = this.win.getContentSize();
    const total = WIDTH + PAD * 2;
    const tall = (typeof height === 'number' ? height : 120) + PAD * 2;
    // Under the button, right edges lined up; else the page's top right.
    const x = anchor
      ? anchor.x + anchor.width - total + PAD
      : page.x + page.width - total + PAD - 12;
    const y = anchor ? anchor.y + anchor.height + 6 - PAD : page.y + 8 - PAD;
    view.setBounds({
      x: Math.round(Math.max(0, Math.min(x, winWidth - total))),
      y: Math.round(Math.max(0, Math.min(y, winHeight - tall))),
      width: total,
      height: tall,
    });
    // Adding it again brings it above pages opened since.
    this.win.contentView.addChildView(view);
    view.setVisible(true);
    let action: unknown;
    try {
      action = await view.webContents.executeJavaScript('window.choice()');
    } catch {
      action = 'close';
    }
    if (id !== this.current) return;
    try {
      const file = download.file();
      if (action === 'show') shell.showItemInFolder(file);
      else if (action === 'open') download.open?.();
      // Hidden only after the drop, so the drag keeps its source.
      else if (action === 'drag')
        view.webContents.startDrag({ file, icon: await app.getFileIcon(file) });
    } catch {
      /* The file moved or was deleted; the card just closes. */
    }
    if (id === this.current) this.hide();
  }
  hide() {
    ++this.current;
    if (this.view && !this.view.webContents.isDestroyed())
      this.view.setVisible(false);
  }
}
