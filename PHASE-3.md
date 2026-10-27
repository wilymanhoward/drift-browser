# Phase 3 validation

Validated on Windows, 27 October 2026. Scope: command navigation, searchable history, foldered bookmarks, and the local new-tab page.

## Checklist

- PASS: strict TypeScript production build, ESLint, and Prettier.
- PASS: 62 unit cases cover URL normalization, search resolution and bounds, fuzzy ranking, session/IPC validation, library validation, bookmark identity during edits, history updates, HTML escaping, and internal route/CSP restrictions.
- PASS: six Electron end-to-end workflows cover prior navigation/tab/window behavior, unpinned window controls, command/library/new-tab behavior, restart/crash restore, and preservation of corrupt session and library files.
- PASS: the same desktop suite runs against Vite development mode. Tests identify trusted chrome separately from tab pages.
- PASS: Ctrl+L and Ctrl+T work through Electron input events with a native page focused. The command bar selects its initial address, supports keyboard result selection, navigates to a matching tab, and executes a history command.
- PASS: a local fixture verifies new-tab URL entry, favicon/tab isolation regressions, history entries, folder edits, address edits without duplication, favorites, bookmark removal, and history clearing.
- PASS: a routed Google fixture verifies search query encoding and the chosen default without depending on an external search service. Google replaced the original DuckDuckGo default at the user's request.
- PASS: bookmarks and history survive restart; the test reads cleared arrays from the saved file after closing the app.
- PASS: the internal new-tab document has no Node globals or preload bridge. Invalid schemes are rejected; its form and clock run under a strict CSP.
- PASS: both the new-tab layout and command dialog fit the supported 640 × 440 minimum width without horizontal overflow, including resizing with a captured background displayed.
- PASS: screenshots of command search, grouped bookmarks, and new tab were visually inspected. Native Windows inspection confirmed Ctrl+L and selected address focus over an actual web page.
- PASS: 21st review completed. Color notices refer to the existing palette; its autofocus notice is intentionally retained for explicitly opened modal search, with the reason recorded in DESIGN.md. Catalog retrieval remains unavailable without login; local components were reused.

## Antislop delivery gate

Evidence: renderer/internal source, `DESIGN.md`, `tests/command.test.ts`, and the six desktop workflows. Desktop minimum is 640 × 440; mobile and other desktop platforms are outside this validation. Small icon controls follow the user's explicit desktop specification.

### Hard gate

- R-02 PASS: authored UI copy has no em dashes.
- R-03 PASS: titles/URLs truncate, library/dialog lists scroll, the compact rail can scroll at short heights, and minimum-size overflow checks pass.
- R-17 PASS: displayed dates, clocks, page titles, and library entries come from actual local time or stored visits; no marketing statistics appear.
- R-18 PASS: no testimonials appear.
- R-23 PASS: new-tab layout and command bar were user-specified. No custom logos, people, or invented asset data were created.
- R-24 PASS: only implemented commands appear; library/favorite links use validated saved URLs.
- R-25 PASS: neutral/green text colors remain from the measured Phase 1 palette: 10.31:1 body/chrome, 9.29:1 selected text, 5.72:1 muted/status, 7.03:1 errors, and 5.90:1 placeholder. White search/save button text on the dark green accent measures 6.08:1. Disabled controls are exempt.
- R-26 PASS: navigation submit, suggestions, library search, save/edit/remove, clear history, favorite navigation, close dialog, and the existing controls all have real handlers and test coverage.
- R-27 PASS: dialogs have loading and error feedback; history/bookmarks/favorites have honest empty states; invalid input and failed loads have recovery paths.
- R-28 PASS: no FAQ is present.
- R-32 PASS: native dialog focus trapping, selected address input, Up/Down result selection, Enter, Escape, semantic controls, and visible focus are implemented and exercised.
- R-33 PASS: features are authored directly in source; no source-rewriting feature scripts exist.
- R-34 PASS: no theme toggle is shipped; themes remain Phase 5 as requested.
- R-35 PASS: build, app launches, six control workflows, screenshot review, and native keyboard inspection completed.
- R-36 PASS: privacy and performance guarantees are not claimed; missing Phase 4 protections are named in README.md.
- R-37 PASS: the user's brief and DESIGN.md specify direction; ENERGY 1 / RHYTHM 1 / MOTION 1 remain explicit.
- R-38 PASS: favorites and search suggestions are real tabs/visits/bookmarks; no fabricated content is authored.

### Purpose gate

- R-01 PASS: no gradients.
- R-04 PASS: user-requested Lucide symbols represent real navigation, search, folder, history, bookmark, edit, remove, and window actions.
- R-06 PASS: Segoe/system type follows the Windows target; the new-tab clock uses size to establish the requested clock focal point.
- R-07 PASS: no decorative background patterns.
- R-08 PASS: the command submit arrow performs navigation/search.
- R-09 PASS: source labels are plain text; no capsule badges are used.
- R-10 PASS: no authored glass effects.
- R-12 PASS: one modal shadow separates command/library interaction from the page; its purpose is recorded in DESIGN.md.
- R-13 PASS: no authored glows.
- R-14 PASS: library rows reflect stored content; there are no feature cards.
- R-19 PASS: loading motion retains reduced-motion handling. The command bar does not add decorative transitions.
- R-22 PASS: no illustrations.

### Liveliness

- PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 are explicit.
- PASS: predictable rows and loading-only animation match those values.
- PASS: the page, command input, or new-tab clock supplies one focal point per context.
- PASS: whitespace separates clock/search/favorites and input/results.
- PASS: forest green is the deliberate action, focus, and selection accent.
- PASS: the narrow rail, soft green selection, and quiet system typography repeat Drift's identity.
- PASS: the design read and new composition reasons are recorded in DESIGN.md.

### Craftsmanship and quality locks

- C-1 PASS: reasons cover native-page capture, modal elevation, clock hierarchy, folders, and modal focus.
- C-2 PASS: controls act on actual state; unimplemented commands are omitted.
- C-3 PASS: each surface follows browsing/library tasks without marketing sections.
- C-4 PASS: keyboard, minimum size, failed input, storage corruption, prior window controls, and session recovery remain checked.
- C-5 PASS: no fabricated claims or content.
- R-05 PASS: no template sections; rows reflect real saved pages.
- R-11 PASS: small control radii and slightly larger dialog/form radii match the existing system.
- R-15 PASS: action labels are concrete, including Save bookmark, Clear history, and Bookmark this page.
- R-16 PASS: no marketing buzzwords.
- R-20 PASS: composition follows the content-first Drift brief with the existing neutral palette.
- R-21 PASS: theme controls remain within the explicit Phase 5 boundary.
- R-29 PASS: neutral surfaces, one green accent, and functional error red.
- R-30 PASS: no reference branding or assets are copied.
- R-31 PASS: major design choices have written reasons in DESIGN.md.

## Limits

Google is fixed until Phase 5 search settings. History keeps 5,000 unique URLs rather than a complete per-visit timeline; bookmarks are capped at 2,000 with flat named folders and six new-tab favorites. The library is local plaintext and uses a 250ms autosave delay. Restart restores page URLs rather than form contents or navigation stacks. Captured backgrounds are temporary in-memory still frames; pages remain alive underneath. Privacy Shields, third-party cookie policy, HTTPS-only upgrades, permission prompts, private windows, workspaces, compact mode, and installers remain in later phases. Permissions are denied in the interim. macOS/Linux are untested.
