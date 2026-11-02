import { ipcRenderer } from 'electron';

// Isolated from site styles; the only message this control can send dismisses its own preview.
if (window === window.top) {
  let appearance = { dark: false, accent: '#5856d6', zoom: 1, visible: true };
  let host: HTMLDivElement | undefined;
  let icon: SVGSVGElement;
  const update = () => {
    if (!host) return;
    const { dark, accent, zoom, visible } = appearance;
    for (const [key, value] of Object.entries({
      all: 'initial',
      position: 'fixed',
      display: visible ? 'block' : 'none',
      top: `${10 / zoom}px`,
      right: `${10 / zoom}px`,
      width: `${32 / zoom}px`,
      height: `${32 / zoom}px`,
      'z-index': '2147483647',
      '--preview-bg': dark ? '#26272cf2' : '#fffffff2',
      '--preview-text': dark ? '#f5f5f7' : '#1d1d1f',
      '--preview-border': dark ? '#ffffff29' : '#00000026',
      '--preview-accent': accent,
    }))
      host.style.setProperty(key, value, 'important');
    icon.style.width = `${16 / zoom}px`;
    icon.style.height = `${16 / zoom}px`;
  };
  ipcRenderer.on(
    'drift:preview-control',
    (_event, value: typeof appearance) => {
      appearance = value;
      update();
    },
  );
  ipcRenderer.on(
    'drift:preview-close-animation',
    (_event, duration: number) => {
      const finish = () => ipcRenderer.send('drift:preview-close-finished');
      document.documentElement.inert = true;
      try {
        const animation = document.documentElement.animate(
          [
            { opacity: 1, transform: 'translateX(0)' },
            { opacity: 0, transform: 'translateX(16px)' },
          ],
          { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
        );
        void animation.finished.then(finish, finish);
      } catch {
        finish();
      }
    },
  );
  window.addEventListener(
    'DOMContentLoaded',
    () => {
      host = document.createElement('div');
      host.dataset.driftPreviewClose = '';
      const root = host.attachShadow({ mode: 'closed', delegatesFocus: true });
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`
      button{box-sizing:border-box;display:grid;place-items:center;width:100%;height:100%;padding:0;border:1px solid var(--preview-border);border-radius:50%;background:var(--preview-bg);color:var(--preview-text);box-shadow:0 2px 8px #00000026;cursor:pointer}
      button:hover{filter:brightness(.94)}
      button:focus-visible{outline:2px solid var(--preview-accent);outline-offset:-3px}
      svg{display:block;pointer-events:none}
      @media print{button{display:none}}
    `);
      root.adoptedStyleSheets = [sheet];
      const button = document.createElement('button');
      let closing = false;
      button.type = 'button';
      button.setAttribute('aria-label', 'Close preview');
      button.title = 'Close preview';
      icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
      icon.append(path);
      button.append(icon);
      button.addEventListener('click', (event) => {
        if (event.isTrusted && !closing) {
          closing = true;
          button.disabled = true;
          ipcRenderer.send(
            'drift:close-preview',
            matchMedia('(prefers-reduced-motion: reduce)').matches,
          );
        }
      });
      root.append(button);
      update();
      document.documentElement.append(host);
    },
    { once: true },
  );
}
