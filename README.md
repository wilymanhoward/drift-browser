# Drift

Phases 1 through 7 of a personal Chromium desktop browser for Windows. Electron 45, strict TypeScript, React, and Vite.

The sidebar footer contains only Settings and Shields. Open **Settings → Browser tools** for history, bookmarks, downloads, workspace management, find, print, compact/split/fullscreen controls, reopening a tab, and page zoom. Workspace icons appear only when more than one workspace exists. All keyboard shortcuts remain available.

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
- Internal CSP, blocked chrome navigation/popups, and explicit HTTP/HTTPS/internal routes. Website permissions use the Phase 4 prompts.
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
- Each tab retains its own live document and navigation history while switching. Phase 6 unloads eligible inactive pages after the configured timeout.
- `electron-store` atomically saves tab URLs, order, active tab, mute state, sidebar width, and pinned state to `session.json` in Electron's user-data directory. Autosave waits 250ms after changes and flushes on window close.
- Restart restores those URLs into new page documents. Navigation stacks, form contents, scroll position, and the recently closed list are not persisted across restarts. A crash can lose the most recent changes before autosave. Session URLs are stored as local plaintext.
- Invalid or unreadable session files are preserved; the browser opens a fresh session with a visible storage warning and avoids overwriting the original.

Validation: [Phase 1](PHASE-1.md), [Phase 2](PHASE-2.md), [Phase 3](PHASE-3.md).

## Phase 3

- Ctrl+L opens the command bar with the current address selected. Ctrl+T creates an internal new tab and opens the bar in new-tab mode; Escape leaves the new tab open.
- Enter browses a URL or searches Google. Down/Up chooses a fuzzy match from open tabs, history, bookmarks, and implemented commands; Enter activates it. Click a result to select it directly. Escape or the close button restores the page and its focus.
- Commands include new/reopen tab, history, bookmarks, pin/unpin sidebar, reload, settings, workspaces, downloads, compact mode, and split view.
- Ctrl+H or Settings → Browser tools → History opens searchable history. Clear history removes the stored list. The library keeps the latest 5,000 unique web URLs with titles, timestamps, and visit counts; internal pages are excluded.
- Ctrl+Shift+B or Settings → Browser tools → Bookmarks opens bookmarks. Choose Bookmark this page, edit its title/address/folder, or remove an entry. Up to 2,000 bookmarks are stored in flat named folders. Changing a saved address preserves the bookmark's identity.
- `drift://newtab/` shows a local clock/date, a URL/search field, and up to six saved favorites. It loads only bundled resources, has its own strict CSP, and receives no preload bridge or Node access. Its form shares the same URL/search resolver as the command bar.
- History and bookmarks persist in `library.json` beside `session.json`. Writes use electron-store's atomic storage, autosave after 250ms, and flush on window close. Unreadable or malformed files remain untouched while the app reports unavailable storage.
- The command bar and library dialogs hide native page views while showing a local captured frame behind the dialog. Pages stay alive. Captures exist in memory only and are discarded when the dialog closes.
- Google is the search default, as requested. Settings offers other engines and custom HTTPS search templates. There are no remote search suggestions.

## Phase 4

- Shields blocks matching network requests using bundled EasyList/EasyPrivacy, refreshes weekly, counts blocks, and supports per-site exceptions.
- Tracking parameters are removed; public HTTP requests upgrade to HTTPS. Failed upgrades require an explicit site exception. Loopback remains usable for local development.
- Third-party network Cookie/Set-Cookie headers are stripped. **This is incomplete cookie isolation:** embedded scripts may still read cookies created in a first-party context. Electron does not expose Chrome's full cookie policy API. Fingerprinting mitigation is limited to normalized user agent and known filter-list scripts.
- Sensitive permissions prompt per document, with per-origin blocks. Secure DNS is app-wide; system, Cloudflare and Quad9 are available. Clear-on-exit removes cookies, cache and history. Private windows use a separate in-memory session and library.
- No telemetry or remote crash reporter is configured. Filter-list refreshes and user browsing cause network traffic.

Validation and limitations: [Phase 4](PHASE-4.md).

## Phase 5

- Open Settings with the gear, command bar, or Ctrl+,. Light/dark/system themes, accent, both sidebar widths/position, density, native corners, inset and shadow apply live.
- Local wallpaper, custom UI CSS, startup behavior, search engine/templates, hover expansion and unloading timeout are configurable. Advanced CSS can hide controls; export a backup first.
- Shortcuts are editable with duplicate/format validation. JSON import/export covers appearance, behavior and shortcuts, including sidebar width. Library/session/privacy stores remain separate.

Validation: [Phase 5](PHASE-5.md).

## Phase 6

- Manage up to nine named workspaces with icons and accent colors. Each owns its tabs and pinned essentials. Switch using sidebar icons or Ctrl+Alt+1 through 9. Workspaces share cookies/logins; private windows remain isolated.
- Drop a tab onto Essentials, use the pin button, or choose Pin in its menu. Pinned tiles form a grid; drag them to regular tabs to unpin. The menu can move tabs to another workspace. Removing a workspace preserves its tabs by moving them to another workspace.
- Ctrl+Alt+C hides the sidebar. A six-pixel edge on the chosen side reveals it over a captured frame; the live page returns on exit. The frame is held briefly while the sidebar is hovered, avoiding native-view layering problems.
- Ctrl+Shift+S splits the current and another tab in the workspace. The tab menu can choose a specific partner. Drag the divider or focus it and use Left/Right to resize. Clicking a pane makes it the navigation target. Toggle split again to return to one page.
- Eligible inactive tabs unload after the chosen timeout, checked every 30 seconds. Active, split, pinned, loading, audible and DevTools tabs are excluded. The tab menu can sleep a background tab immediately. Selecting it recreates the renderer and navigation history; unsaved page/form state may be lost.
- Ctrl+J opens downloads with progress, pause/resume, cancel, and Show in folder. Files use the native save dialog and never open automatically. The list lasts for the window; closing the window cancels its active transfers. Resume depends on server support.
- Sessions preserve workspace definitions, tab membership/order and pins. Old sessions migrate to Personal. Compact/split presentation and download records are not persisted.

Validation and UI gate: [Phase 6](PHASE-6.md).

## Phase 7 and Windows builds

- Find in page uses Ctrl+F, with next/previous matches, counts and Escape to return to the page. The native page stays interactive below the find bar.
- Ctrl+= / Ctrl+- / Ctrl+0 adjust/reset zoom. Zoom is stored per web origin; private windows keep changes in memory. Controls also appear in Settings → Browser tools and the command bar.
- Ctrl+P opens the native print dialog. Page context menus provide editable-field actions, open/copy link, save image, find, print and inspect.
- F11 toggles window fullscreen. HTML fullscreen content fills the native view, hiding the sidebar until exit. Fullscreen follows Chromium's user-gesture rule; camera, microphone, location and notification access retain permission prompts.
- Restored background tabs start dormant; only active and pinned pages load immediately. Selecting a dormant tab loads it. This reduces startup activity for large sessions. Find stops on navigation/tab changes.
- Active tabs use a single keyboard tab stop with arrow navigation, all form controls have visible focus, and dialogs use a restrained 160ms entry animation with a reduced-motion alternative. Automated axe WCAG A/AA checks cover Settings, Workspaces and Downloads in light/dark themes. This is not a screen-reader certification.

```sh
npm run dist:win       # NSIS installer + portable x64 executable
npm run pack:win       # unpacked app for inspection
npm run test:packaged  # requires the unpacked build
npm run measure        # local startup/idle benchmark
```

Outputs are `release/Drift-Setup-0.1.0-x64.exe`, `release/Drift-Portable-0.1.0-x64.exe`, and `release/win-unpacked/Drift.exe`. The installer is per-user and allows choosing its directory; uninstall preserves user data. The portable executable needs no installation, but its default profile still lives in Electron's user-data directory rather than beside the executable. Use `--user-data-dir=<absolute directory>` for an isolated profile.

Builds are unsigned and retain the default Electron icon. No updater or publishing service is configured. A production signing certificate and user-supplied app icon can be added before public distribution. Dependencies and bundled filter licensing are described in THIRD-PARTY-NOTICES.md. Windows x64 is tested; ARM64, macOS and Linux are not.

Phase report, measurements and validation: [Phase 7](PHASE-7.md).

## Remaining limitations

Extension support remains a stretch goal. Workspaces share cookies, split view supports two panes, and compact reveal uses a held frame. The Phase 4 DOM-cookie and fingerprinting limitations still apply. Session/history/bookmark/zoom files contain local plaintext browsing data, and crashes may lose recent unsaved changes. Private windows do not persist their browser history, but downloads are real files and the operating system may retain its own records. Hardware printers, camera/microphone grants and broad media-codec/DRM compatibility are not validated by the automated suite.
