import { WebContentsView } from 'electron';
import type { BrowserWindow, Rectangle } from 'electron';

const WIDTH = 300;
// Room around the card for its shadow.
const PAD = 14;

// "Restore tabs?", offered at the top right when Drift opened a new tab
// instead of the last session, as Brave and Chrome do. A transparent view of
// its own, like the download popup, since nothing in the renderer can sit
// over a page.
const POPUP_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style id="theme"></style><style>
*{box-sizing:border-box}
html,body{margin:0;background:transparent;overflow:hidden}
body{font:13px/1.35 'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;padding:${PAD}px}
.card{width:${WIDTH}px;padding:12px;border-radius:var(--radius);background:var(--surface);border:.5px solid var(--hairline);box-shadow:inset 0 .5px 0 var(--glass-edge),0 1px 2px #0000001a,0 8px 22px #1e14502e;animation:enter .16s ease-out}
body.dark .card{box-shadow:inset 0 .5px 0 #ffffff1a,0 1px 2px #00000066,0 8px 22px #0000008c}
@keyframes enter{from{opacity:0;transform:translateY(-4px) scale(.98)}}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
.head{display:flex;align-items:flex-start;gap:8px}
.head svg{flex:none;margin-top:1px;color:var(--highlight)}
.text{flex:1;display:grid;gap:2px}
.title{font-weight:600}
.detail{color:var(--muted);font-size:12px}
button{font:inherit;color:inherit;border:0;margin:0;cursor:default;background:transparent}
button:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 75%,transparent);outline-offset:2px}
.close{display:grid;place-items:center;width:24px;height:24px;margin:-4px -4px 0 0;border-radius:7px;color:var(--muted)}
.close:hover{background:var(--hover);color:var(--text)}
.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.text-button{min-height:30px;padding:5px 12px;border-radius:8px;background:var(--input-bg);font-weight:500}
.text-button:hover{background:color-mix(in srgb,var(--input-bg),var(--text) 6%)}
</style></head><body><div class="card" role="dialog" aria-labelledby="title">
<div class="head"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
<div class="text"><span class="title" id="title">Restore tabs?</span><span class="detail" id="detail"></span></div>
<button class="close" id="close" aria-label="Close">✕</button></div>
<div class="actions"><button class="text-button" id="dismiss">Not now</button><button class="text-button" id="restore">Restore</button></div>
</div><script>
let pick = null, timer = 0;
const choose = (value) => { clearTimeout(timer); const done = pick; pick = null; if (done) done(value); };
window.choice = () => new Promise((resolve) => { pick = resolve; });
// It goes by itself after a while, but never from under the mouse.
const later = () => { clearTimeout(timer); timer = setTimeout(() => choose('close'), 30000); };
document.body.onmouseenter = () => clearTimeout(timer);
document.body.onmouseleave = later;
document.getElementById('close').onclick = () => choose('close');
document.getElementById('dismiss').onclick = () => choose('close');
document.getElementById('restore').onclick = () => choose('restore');
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') choose('close'); });
window.render = (d) => {
  document.getElementById('theme').textContent = d.theme;
  document.body.classList.toggle('dark', d.dark);
  document.getElementById('detail').textContent = d.detail;
  later();
  return Math.ceil(document.querySelector('.card').getBoundingClientRect().height);
};
</script></body></html>`;

// Resolves true when the user chooses Restore.
export async function askToRestore(
  win: BrowserWindow,
  detail: string,
  page: Rectangle,
  theme: { css: string; dark: boolean },
): Promise<boolean> {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  view.setBackgroundColor('#00000000');
  const contents = view.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
  try {
    await contents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(POPUP_HTML)}`,
    );
    const height = await contents.executeJavaScript(
      `window.render(${JSON.stringify({ detail, theme: theme.css, dark: theme.dark })})`,
    );
    if (win.isDestroyed()) return false;
    const total = WIDTH + PAD * 2;
    const [winWidth] = win.getContentSize();
    view.setBounds({
      x: Math.round(
        Math.max(
          0,
          Math.min(page.x + page.width - total + PAD - 12, winWidth - total),
        ),
      ),
      y: Math.round(Math.max(0, page.y + 8 - PAD)),
      width: total,
      height: (typeof height === 'number' ? height : 110) + PAD * 2,
    });
    win.contentView.addChildView(view);
    const closed = new Promise<string>((resolve) =>
      win.once('closed', () => resolve('close')),
    );
    const action = await Promise.race([
      contents.executeJavaScript('window.choice()') as Promise<string>,
      closed,
    ]);
    return action === 'restore';
  } catch {
    return false;
  } finally {
    if (!win.isDestroyed()) win.contentView.removeChildView(view);
    if (!contents.isDestroyed()) contents.close();
  }
}
