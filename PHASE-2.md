# Phase 2 validation

Validated on Windows, 27 October 2026. Scope: vertical tabs, sidebar interaction, and session restore.

## Phase checklist

- PASS: strict TypeScript production build, ESLint, and Prettier.
- PASS: 41 unit tests cover URL handling, session validation, tab command validation, and sidebar input limits.
- PASS: three Playwright end-to-end tests run against the built app and the Vite development server.
- PASS: Phase 1 navigation, error recovery, window controls, security isolation, and minimum-size checks remain covered.
- PASS: separate tab views retain a typed form value while switching; exactly one view is visible.
- PASS: collapsed 48px sidebar, delayed hover expansion, collapse, pinning, pointer resize, keyboard resize, and persisted 280px width.
- PASS: favicons, titles, tab creation, selection, tab cycling, drag reorder, keyboard reorder, middle-click close, last-tab replacement, close/reopen, duplicate, mute/unmute, and close-others workflows.
- PASS: Ctrl+T/W/Shift+T/Tab/Shift+Tab are exercised through Electron input events, including tab cycling from web content. These events reach Electron's shortcut handler; Playwright DOM key dispatch does not.
- PASS: reopening a tab restores its back navigation within the current session.
- PASS: new-window page links open a new sandboxed tab.
- PASS: tab order, active tab, muted state, and sidebar preferences restore after graceful restart; tab order also restores after forced termination of the isolated test process.
- PASS: corrupt JSON remains byte-for-byte unchanged after startup/exit, while the UI reports unavailable storage.
- PASS: native Windows inspection confirms expanded and collapsed sidebar layouts beside the actual embedded page. Native context-menu Duplicate and the tab close button were clicked successfully.
- PASS: 21st review completed. Its informational color warnings refer to the existing explicit palette; theming controls remain Phase 5. Catalog retrieval was unavailable without login; local controls were reused.

## Antislop delivery gate

Evidence: `DESIGN.md`, renderer source, `tests/session.test.ts`, `tests/e2e/browser.spec.ts`, `tests/e2e/tabs.spec.ts`, and native Windows inspection. Desktop sizes are 640 × 440 minimum and 1320 × 860 default; mobile is outside the product scope. The user explicitly requested small desktop icon controls.

### Hard gate

- R-02 PASS: authored UI copy has no em dashes.
- R-03 PASS: supported desktop width/overflow checks remain in the regression test; tabs scroll vertically and titles truncate.
- R-17 PASS: no marketing statistics appear.
- R-18 PASS: no testimonials appear.
- R-23 PASS: product name, layout, and Lucide were user-specified; no custom logos or people assets were created.
- R-24 PASS: navigation and tab controls act on real content; no links to future internal pages are shown.
- R-25 PASS: unchanged palette retains 10.31:1 body/chrome, 9.29:1 selected-tab text, 5.72:1 status, 7.03:1 error, and 5.90:1 placeholder contrast from Phase 1 calculations. Disabled controls are exempt; native menu styling is OS-managed.
- R-26 PASS: shipped buttons, address submit, pinning, resize handle, tab selection, and tab actions are exercised by automation or native click-through.
- R-27 PASS: initial loading, missing title/favicon fallback, navigation error, and storage error states exist. The last tab is replaced, preventing an unusable empty window.
- R-28 PASS: no FAQ is present.
- R-32 PASS: semantic controls and visible focus persist; arrow/Home/End tab selection, Alt reorder, keyboard resize, shortcuts, and keyboard address submission are available.
- R-33 PASS: features are authored directly in source, without source-rewriting scripts.
- R-34 PASS: no theme toggle is shipped; themes remain Phase 5 per the explicit phase plan.
- R-35 PASS: production and development app launches, build, automated control workflows, and native visual inspection completed.
- R-36 PASS: privacy/performance guarantees are not claimed; missing privacy controls are listed in README.md.
- R-37 PASS: the user's brief and DESIGN.md supply direction and ENERGY 1 / RHYTHM 1 / MOTION 1.
- R-38 PASS: tab titles, URLs, favicons, loading, and audio indicators represent real page state.

### Purpose gate

- R-01 PASS: no gradients.
- R-04 PASS: user-requested Lucide icons represent navigation, window, panel, tab, audio, and error actions.
- R-06 PASS: Segoe/system type follows the Windows target, with rationale in DESIGN.md.
- R-07 PASS: no decorative background patterns.
- R-08 PASS: arrows perform navigation and panel actions.
- R-09 PASS: no capsule badges.
- R-10 PASS: no authored glass effects; native menu appearance belongs to Electron/Windows.
- R-12 PASS: no authored component shadows.
- R-13 PASS: no authored glows. The visible mouse locator in native captures belongs to the automation environment.
- R-14 PASS: no feature cards.
- R-19 PASS: only the loading indicator animates; reduced motion disables it. Native content and panel bounds update together.
- R-22 PASS: no illustrations.

### Liveliness

- PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 remain explicit.
- PASS: predictable navigation rows and loading-only motion match those dials.
- PASS: the web page remains the focal point, with the rail maximizing content area.
- PASS: spacing separates window actions, navigation, tabs, and recovery/status.
- PASS: forest green remains the deliberate selection/focus accent.
- PASS: the vertical rail and soft green selected tab repeat the Drift identity.
- PASS: the design read and the Phase 2 extension are recorded in DESIGN.md.

### Craftsmanship and quality locks

- C-1 PASS: rationale covers panel behavior, typography, palette, spacing, and native geometry alignment.
- C-2 PASS: controls have working handlers; secondary menu commands reuse the same tab manager.
- C-3 PASS: composition follows browser navigation tasks without marketing sections.
- C-4 PASS: desktop sizing, mouse/keyboard actions, error recovery, restart/crash recovery, and reduced-motion source are checked.
- C-5 PASS: no fabricated claims or content are presented.
- R-05 PASS: no template sections; tab rows reflect actual open pages.
- R-11 PASS: small button radii and eight-pixel selected rows remain consistent.
- R-15 PASS: labels name their actions, including New tab and Reopen closed tab.
- R-16 PASS: no marketing buzzwords.
- R-20 PASS: the content-first rail, neutral chrome, and forest selection follow the Drift brief.
- R-21 PASS: the explicit Phase 5 theme boundary is preserved.
- R-29 PASS: neutral surfaces, one green accent, and functional error red.
- R-30 PASS: no reference-product branding or assets are copied.
- R-31 PASS: major choices have written reasons in DESIGN.md.

## Limits

New tabs still use example.com pending the Phase 3 internal new-tab page. Restart restores URLs rather than full navigation stacks, form state, or scroll position. Recently closed tabs are limited to 25 and remain in memory only. Autosave can lose the newest changes within its 250ms delay on a crash. Saved URLs are local plaintext. Inactive tabs remain loaded; unloading, pinned sites, and workspaces belong to Phase 6. Browser privacy controls and permission prompts remain Phase 4, and requests are denied until then. Actual audio playback was not tested on hardware; mute controls and persisted mute state were tested. macOS/Linux and installer packaging remain untested.
