# Drift

Phases 1 through 3 of a personal Chromium desktop browser for Windows. Electron 45, strict TypeScript, React, and Vite.

## Run

Use Node.js 22.12+ or a current supported release and npm.

```sh
npm ci
npm run dev
```

Vite reloads renderer changes. Restart `npm run dev` after changing main, preload, or internal new-tab sources.

```sh
npm run build
npm start
npm run lint
npm test
npm run test:e2e
```

The end-to-end test launches the built Electron application and uses a local HTTP fixture. No separate Playwright browser download is required. Run it in an interactive Windows desktop session.

## Phase 1

- Frameless window with minimize, maximize/restore, and close controls; drag the Drift label to move it. The rest of the header accepts normal pointer input.
- Sandboxed native `WebContentsView` content, now starting at `drift://newtab/`.
- Click the sidebar domain pill or press Ctrl+L to enter an address in the command bar. Bare domains default to HTTPS.
- Back, forward, reload, page title, loading indicator, and navigation error feedback.
- Typed preload API, strict IPC sender/frame/argument validation, sandboxing and context isolation in both renderers, no Node integration, no preload in web content.
- Internal CSP, blocked chrome navigation/popups, HTTP/HTTPS and the explicit internal new-tab route only, denied permissions until permission prompts exist.
- New-window links now open a separate tab.

Electron security guidance: [Security](https://www.electronjs.org/docs/latest/tutorial/security), [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view).

## Phase 2

- Vertical tabs with favicons, titles, loading indicators, audio/mute indicators, selection, and close buttons.
- A 48px icon rail by default. Hover for 150ms to expand, or pin open. Window controls and the domain pill appear in the expanded panel. A 300ms exit delay keeps controls reachable.
- Resize the expanded sidebar from 220px to 360px by dragging its edge. Focus the edge and use Left/Right for keyboard resizing.
- Drag tabs to reorder, or focus a tab and use Alt+Up/Down. Up/Down and Home/End select tabs. Middle-click closes a tab.
- Right-click a tab or press Shift+F10 for duplicate, mute/unmute, move up/down, close others, and close.
- Closing the last tab opens a replacement. Reopen up to 25 recently closed tabs with their navigation histories during the current session.
- Ctrl+T creates a tab and opens its command bar, Ctrl+W closes, Ctrl+Shift+T reopens, Ctrl+Tab and Ctrl+Shift+Tab switch. Ctrl+L opens the floating command bar, including when a web page has focus.
- Each tab retains its own live document and navigation history while switching. Inactive views are hidden and stay loaded; unloading belongs to Phase 6.
- `electron-store` atomically saves tab URLs, order, active tab, mute state, sidebar width, and pinned state to `session.json` in Electron's user-data directory. Autosave waits 250ms after changes and flushes on window close.
- Restart restores those URLs into new page documents. Navigation stacks, form contents, scroll position, and the recently closed list are not persisted across restarts. A crash can lose the most recent changes before autosave. Session URLs are stored as local plaintext.
- Invalid or unreadable session files are preserved; the browser opens a fresh session with a visible storage warning and avoids overwriting the original.

Pinned sites and workspaces arrive in Phase 6. Validation: [Phase 1](PHASE-1.md), [Phase 2](PHASE-2.md), [Phase 3](PHASE-3.md).

## Phase 3

- Ctrl+L opens the command bar with the current address selected. Ctrl+T creates an internal new tab and opens the bar in new-tab mode; Escape leaves the new tab open.
- Enter browses a URL or searches Google. Down/Up chooses a fuzzy match from open tabs, history, bookmarks, and implemented commands; Enter activates it. Click a result to select it directly. Escape or the close button restores the page and its focus.
- Commands include new/reopen tab, history, bookmarks, pin/unpin sidebar, and reload. Settings and compact-mode commands will appear when those features exist.
- Ctrl+H or the History icon opens searchable history. Clear history removes the stored list. The library keeps the latest 5,000 unique web URLs with titles, timestamps, and visit counts; internal pages are excluded.
- Ctrl+Shift+B or the Bookmarks icon opens bookmarks. Choose Bookmark this page, edit its title/address/folder, or remove an entry. Up to 2,000 bookmarks are stored in flat named folders. Changing a saved address preserves the bookmark's identity.
- `drift://newtab/` shows a local clock/date, a URL/search field, and up to six saved favorites. It loads only bundled resources, has its own strict CSP, and receives no preload bridge or Node access. Its form shares the same URL/search resolver as the command bar.
- History and bookmarks persist in `library.json` beside `session.json`. Writes use electron-store's atomic storage, autosave after 250ms, and flush on window close. Unreadable or malformed files remain untouched while the app reports unavailable storage.
- The command bar and library dialogs hide native page views while showing a local captured frame behind the dialog. Pages stay alive. Captures exist in memory only and are discarded when the dialog closes.
- Google is the current search default, as requested. Engine selection and custom search templates belong to Phase 5. There are no remote search suggestions.

## Next phases

4. Shields, tracker/ad blocking, cookie policy, HTTPS upgrades, permissions, private windows.
5. Settings, themes, CSS, shortcuts, import/export.
6. Workspaces, compact mode, split view, pinned tabs, unloading, downloads.
7. Polish, accessibility pass, performance measurements, NSIS and portable packaging.

This browser does not yet provide privacy Shields, third-party cookie blocking, HTTPS-only policy, or fingerprinting protection. Permission requests remain denied until Phase 4 adds prompts. Session, history, and bookmark files contain local plaintext URLs and titles. A crash may lose the newest unsaved changes. The content inset is rectangular; rounded native clipping is deferred. Installer packaging belongs to Phase 7. Windows is the validation target; macOS/Linux have not been tested.
