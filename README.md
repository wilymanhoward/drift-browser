# Drift

Phase 1 of a personal Chromium desktop browser for Windows. Electron 45, strict TypeScript, React, and Vite.

## Run

Use Node.js 22.12+ or a current supported release and npm.

```sh
npm ci
npm run dev
```

Vite reloads renderer changes. Restart `npm run dev` after changing main or preload code.

```sh
npm run build
npm start
npm run lint
npm test
npm run test:e2e
```

The end-to-end test launches the built Electron application and uses a local HTTP fixture. No separate Playwright browser download is required. Run it in an interactive Windows desktop session.

## Phase 1

- Frameless window with minimize, maximize/restore, and close controls; drag the wordmark/header to move it.
- One native `WebContentsView`, starting at `https://example.com`.
- Enter an HTTP/HTTPS address in the sidebar and press Enter. Bare domains default to HTTPS.
- Back, forward, reload, page title, loading indicator, and navigation error feedback.
- Typed preload API, strict IPC sender/frame/argument validation, sandboxing and context isolation in both renderers, no Node integration, no preload in web content.
- Internal CSP, blocked chrome navigation/popups, HTTP/HTTPS-only page navigation, denied permissions until permission prompts exist.
- New-window links navigate the existing page in this single-view phase.

Electron security guidance: [Security](https://www.electronjs.org/docs/latest/tutorial/security), [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view).

## Next phases

2. Tabs, collapsible sidebar, reordering, session persistence.
3. Command bar, history, bookmarks, new tab page.
4. Shields, tracker/ad blocking, cookie policy, HTTPS upgrades, permissions, private windows.
5. Settings, themes, CSS, shortcuts, import/export.
6. Workspaces, compact mode, split view, pinned tabs, unloading, downloads.
7. Polish, accessibility pass, performance measurements, NSIS and portable packaging.

This skeleton does not yet provide privacy Shields or fingerprinting protection. Chromium uses persistent default storage; history and settings have no application storage layer yet. The content view is rectangular; rounded native content clipping is deferred. Ctrl+L focuses the address field when the chrome has focus; browser-wide shortcuts come in Phase 3. Installer packaging belongs to Phase 7. Windows is the validation target; macOS/Linux have not been tested.
