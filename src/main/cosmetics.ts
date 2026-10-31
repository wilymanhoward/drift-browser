import { ipcMain } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, Session } from 'electron';
import type { ElectronBlocker } from '@ghostery/adblocker-electron';
import { parse } from 'tldts';
import path from 'node:path';
import { isWebURL } from '../shared/navigation';

export interface CosmeticRules {
  styles: string;
  scripts: string[];
}
export interface PageFeatures {
  classes: string[];
  ids: string[];
  hrefs: string[];
}
interface Shields {
  engine: () => ElectronBlocker;
  allowed: (url: string) => boolean;
}
const shields = new Map<Session, Shields>();
let listening = false;

const GLOBALS =
  "if (typeof scriptletGlobals === 'undefined') { var scriptletGlobals = {}; }";
// Scriptlets carry their helpers (e.g. `class JSONPath`) as top-level
// declarations, so running several in one page collides. Give each its own
// function scope while keeping the shared scriptletGlobals global, as
// uBlock Origin does.
function scopeScriptlet(script: string): string {
  const body = script.startsWith(GLOBALS)
    ? script.slice(GLOBALS.length)
    : script;
  return `${GLOBALS}\n(function () {\n${body}\n})();`;
}

function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 5000 &&
    value.every((item) => typeof item === 'string' && item.length <= 2048)
  );
}
function lookup(event: IpcMainEvent | IpcMainInvokeEvent, url: unknown) {
  const target = shields.get(event.sender.session);
  if (
    !target ||
    typeof url !== 'string' ||
    !isWebURL(url) ||
    event.senderFrame?.parent ||
    !target.allowed(url)
  )
    return null;
  const { hostname, domain } = parse(url);
  return {
    engine: target.engine(),
    url,
    hostname: hostname || '',
    domain: domain || '',
  };
}
function listen() {
  if (listening) return;
  listening = true;
  // Synchronous so scriptlets run before the page's own scripts.
  ipcMain.on('drift:cosmetics', (event, url: unknown) => {
    let rules: CosmeticRules | null = null;
    try {
      const page = lookup(event, url);
      if (page) {
        const { active, styles, scripts } = page.engine.getCosmeticsFilters({
          url: page.url,
          hostname: page.hostname,
          domain: page.domain,
          getBaseRules: true,
          getInjectionRules: true,
          getExtendedRules: false,
          getRulesFromHostname: true,
          getRulesFromDOM: false,
        });
        if (active) rules = { styles, scripts: scripts.map(scopeScriptlet) };
      }
    } catch (error) {
      console.error('Cosmetic filtering failed:', error);
    }
    event.returnValue = rules;
  });
  ipcMain.handle(
    'drift:cosmetics-dom',
    (event, url: unknown, features: unknown) => {
      const page = lookup(event, url);
      const value = features as PageFeatures | null;
      if (
        !page ||
        !value ||
        !strings(value.classes) ||
        !strings(value.ids) ||
        !strings(value.hrefs)
      )
        return '';
      return page.engine.getCosmeticsFilters({
        url: page.url,
        hostname: page.hostname,
        domain: page.domain,
        classes: value.classes,
        ids: value.ids,
        hrefs: value.hrefs,
        getBaseRules: false,
        getInjectionRules: false,
        getExtendedRules: false,
        getRulesFromHostname: false,
        getRulesFromDOM: true,
      }).styles;
    },
  );
}
export function enableCosmetics(
  session: Session,
  engine: Shields['engine'],
  allowed: Shields['allowed'],
) {
  listen();
  if (!shields.has(session))
    session.registerPreloadScript({
      type: 'frame',
      filePath: path.join(__dirname, '../preload/shields.cjs'),
    });
  shields.set(session, { engine, allowed });
}
