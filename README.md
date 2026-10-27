# Drift

Phases 1 and 2 of a personal Chromium desktop browser for Windows. Electron 45, strict TypeScript, React, and Vite.

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
- Sandboxed native `WebContentsView` content, starting at `https://example.com`.
- Enter an HTTP/HTTPS address in the sidebar and press Enter. Bare domains default to HTTPS.
- Back, forward, reload, page title, loading indicator, and navigation error feedback.
- Typed preload API, strict IPC sender/frame/argument validation, sandboxing and context isolation in both renderers, no Node integration, no preload in web content.
- Internal CSP, blocked chrome navigation/popups, HTTP/HTTPS-only page navigation, denied permissions until permission prompts exist.
- New-window links now open a separate tab.

Electron security guidance: [Security](https://www.electronjs.org/docs/latest/tutorial/security), [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view).

## Phase 2

- Vertical tabs with favicons, titles, loading indicators, audio/mute indicators, selection, and close buttons.
- A 48px icon rail by default. Hover for 150ms to expand, or pin open. Window controls and the address field appear in the expanded panel.
- Resize the expanded sidebar from 220px to 360px by dragging its edge. Focus the edge and use Left/Right for keyboard resizing.
- Drag tabs to reorder, or focus a tab and use Alt+Up/Down. Up/Down and Home/End select tabs. Middle-click closes a tab.
- Right-click a tab or press Shift+F10 for duplicate, mute/unmute, move up/down, close others, and close.
- Closing the last tab opens a replacement. Reopen up to 25 recently closed tabs with their navigation histories during the current session.
- Ctrl+T creates a tab, Ctrl+W closes, Ctrl+Shift+T reopens, Ctrl+Tab and Ctrl+Shift+Tab switch. Ctrl+L expands and focuses the address field, including when a web page has focus.
- Each tab retains its own live document and navigation history while switching. Inactive views are hidden and stay loaded; unloading belongs to Phase 6.
- `electron-store` atomically saves tab URLs, order, active tab, mute state, sidebar width, and pinned state to `session.json` in Electron's user-data directory. Autosave waits 250ms after changes and flushes on window close.
- Restart restores those URLs into new page documents. Navigation stacks, form contents, scroll position, and the recently closed list are not persisted across restarts. A crash can lose the most recent changes before autosave. Session URLs are stored as local plaintext.
- Invalid or unreadable session files are preserved; the browser opens a fresh session with a visible storage warning and avoids overwriting the original.

The command bar and internal new-tab page arrive in Phase 3; new tabs currently open `https://example.com`. Pinned sites and workspaces arrive in Phase 6. Validation: [Phase 1](PHASE-1.md), [Phase 2](PHASE-2.md).

## Next phases

3. Command bar, history, bookmarks, new tab page.
4. Shields, tracker/ad blocking, cookie policy, HTTPS upgrades, permissions, private windows.
5. Settings, themes, CSS, shortcuts, import/export.
6. Workspaces, compact mode, split view, pinned tabs, unloading, downloads.
7. Polish, accessibility pass, performance measurements, NSIS and portable packaging.

This browser does not yet provide privacy Shields, third-party cookie blocking, HTTPS-only policy, or fingerprinting protection. Permission requests remain denied until Phase 4 adds prompts. Chromium uses a persistent session; a searchable history/bookmarks database has not been built. The content inset is rectangular; rounded native clipping is deferred. Installer packaging belongs to Phase 7. Windows is the validation target; macOS/Linux have not been tested.
