# Phase 7

Implemented find-in-page, persistent per-origin zoom, native print dispatch, page context menus and HTML fullscreen layout. Added keyboard tab stops/focus treatment, reduced-motion-aware dialog entry, lazy restoration of background tabs, reproducible performance measurements, and electron-builder NSIS/portable Windows x64 targets. Google remains the default search engine.

Validation:

- Production TypeScript/Vite/Electron build, lint and 67 unit tests pass.
- All 10 Electron tests pass. Follow-up tools/privacy tests cover HTML fullscreen entry/exit and full-width native bounds, real print-to-PDF rendering, find counts/next/previous/empty results/Escape, zoom persistence, context-menu dispatch, and window fullscreen.
- axe WCAG A/AA checks report zero violations on Settings, Workspaces and Downloads in light/dark themes. Keyboard resizing/navigation and minimum supported 640×440 window overflow checks pass. These checks do not certify all assistive-technology combinations.
- The packaged ASAR application launches, loads its internal new tab and bundled filter state, exposes the expected trusted bridge, and opens Shields/Settings. NSIS and portable executables are built locally; checksums accompany them. Installation into this user's Windows profile is deliberately not part of the smoke test.
- The portable executable was also launched with an isolated test profile and inspected natively at its internal new tab and find toolbar, then closed. Windows file metadata identifies the executable as Drift 0.1.0.
- Native visual inspection confirms working sidebar, sleep indicators, zoom and page-tool controls. The UI gate is in [the delivery report](anti-slop/delivery-007.md).

## Measurements

Source: [recorded JSON](docs/performance-2026-10-27.json), Windows x64, Electron 45, local new tab and bundled filters. Three fresh-profile launches were 730, 797 and 736ms to ready content (median 736ms). Ten-second idle samples used 388–404 MiB of summed process private memory and 0.09–0.14% summed Electron CPU readings. Summed working sets were 801–818 MiB and can count shared pages more than once.

A saved session with 20 tabs reached ready content in 789ms, with one loaded page and 19 dormant tabs. Its idle private-memory sample was 392 MiB. This confirms lazy restoration without claiming a before/after speedup or a bound for arbitrary websites. The benchmark uses Playwright's instrumented launch on this machine; hardware, caches, other apps and page content change results. Filters and Electron's GPU/network/renderers are included. `npm run measure` reproduces the measurement and keeps disposable profiles under test-results.

## Release output

- `release/Drift-Setup-0.1.0-x64.exe`: per-user NSIS installer, optional install directory, user data preserved on uninstall.
- `release/Drift-Portable-0.1.0-x64.exe`: no-install executable; its default profile remains in Electron's user-data directory.
- `release/win-unpacked/Drift.exe`: unpacked app used by `npm run test:packaged`.

Builds are unsigned, use the default Electron icon, and have no updater/publishing service. Public distribution still needs the owner's icon/signing decisions. No Windows installer is installed automatically during development validation. ARM64/macOS/Linux, hardware printer output, OS camera/microphone grants, DRM and broad video-codec compatibility remain untested.

The Phase 4 cookie/fingerprinting limits and Phase 6 workspace/compact-frame limitations remain. Extension support is still a stretch goal. No claim of complete Brave-equivalent privacy is made.
