import { ipcRenderer, webFrame } from 'electron';
import { DOMMonitor } from '@ghostery/adblocker-content';
import type { CosmeticRules, PageFeatures } from '../main/cosmetics';
import { youtubeCompatibility } from './youtube';

// Runs in every page before its scripts. Hiding rules and scriptlets come
// from the main process so the Shields site toggle applies to them too.
if (window === window.top && /^https?:$/.test(location.protocol)) {
  const url = location.href;
  const rules = ipcRenderer.sendSync(
    'drift:cosmetics',
    url,
  ) as CosmeticRules | null;
  if (rules) {
    if (
      location.hostname === 'youtube.com' ||
      location.hostname.endsWith('.youtube.com')
    )
      void webFrame
        .executeJavaScript(`(${youtubeCompatibility.toString()})();`)
        .catch(() => undefined);
    for (const script of rules.scripts)
      webFrame.executeJavaScript(script).catch(() => undefined);
    if (rules.styles) webFrame.insertCSS(rules.styles, { cssOrigin: 'user' });
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        const monitor = new DOMMonitor((update) => {
          if (update.type !== 'features') return;
          const features: PageFeatures = {
            classes: update.classes,
            ids: update.ids,
            hrefs: update.hrefs,
          };
          void ipcRenderer
            .invoke('drift:cosmetics-dom', url, features)
            .then((styles: string) => {
              if (styles) webFrame.insertCSS(styles, { cssOrigin: 'user' });
            });
        });
        monitor.queryAll(window);
        monitor.start(window);
      },
      { once: true },
    );
  }
}
