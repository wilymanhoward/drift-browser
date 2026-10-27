# Phase 1 validation

Validated on Windows, 27 October 2026. Scope: one native web content view with minimal browser chrome. Later phases remain pending.

## Checklist

- PASS: strict TypeScript and production Vite/esbuild build complete.
- PASS: ESLint and Prettier checks complete.
- PASS: 12 Vitest cases cover URL normalization, unsafe protocols, malformed values, and credential rejection.
- PASS: Playwright launches the built Electron application and browses two local HTTP pages.
- PASS: back, forward, reload, title, loading feedback, invalid input, Escape reset, failed navigation, and recovery work.
- PASS: minimize, maximize, restore, close, and minimum-size layout are exercised in Electron.
- PASS: web content has no `process`, `require`, or `window.drift`; invalid IPC actions reject.
- PASS: source sets sandbox/context isolation and disables Node integration for both renderers; only chrome receives a preload.
- PASS: the same end-to-end workflow passes against the Vite development server, including a computed sidebar-width assertion to catch missing styles.
- PASS: native Windows capture confirms that the sidebar and actual external page render together. A Playwright chrome screenshot alone omits the native child view.

## Antislop delivery gate

Evidence references: `src/renderer/main.tsx`, `src/renderer/style.css`, `DESIGN.md`, `tests/e2e/browser.spec.ts`, and the commands above. Desktop layout is tested at the supported 640 × 440 minimum and 1320 × 860; mobile is outside this desktop app's scope. Small icon controls follow the user's explicit desktop specification.

### Hard gate

- R-02 PASS: authored interface copy contains no em dashes.
- R-03 PASS: sidebar uses a fixed desktop width; the test checks no document overflow at minimum window size, and main resizes the content view.
- R-17 PASS: no statistics appear in the chrome.
- R-18 PASS: no testimonials appear.
- R-23 PASS: the user specified navigation/layout and Lucide; wordmark is plain product text, with no custom assets or fabricated identities.
- R-24 PASS: all navigation buttons operate the current native page; no future-feature links are shown.
- R-25 PASS: calculated text contrast is 10.31:1 on chrome, 11.35:1 in the address field, 9.29:1 on the selected row, 5.72:1 for status, 7.03:1 for errors, and 5.90:1 for the placeholder. Close-hover text/icons measure 6.54:1. Disabled controls are exempt.
- R-26 PASS: the end-to-end workflow activates every button and submits the address form.
- R-27 PASS: empty/title fallback, loading indicator/status, and actionable navigation-error copy are implemented; failure and recovery are tested.
- R-28 PASS: no FAQ is present.
- R-32 PASS: semantic buttons/input, accessible names, visible focus, keyboard form submission and Escape; the test checks focus navigation using Shift+Tab and activates reload using Enter.
- R-33 PASS: features are authored in source; no runtime source-rewriting scripts. Vite's development-only HTML transform configures CSP for its style/refresh injection.
- R-34 PASS: no theme toggle is shipped; theming is explicitly Phase 5 in the user's instructions.
- R-35 PASS: build, live launch, native screenshot inspection, and automated click-through completed for all shipped controls.
- R-36 PASS: no privacy, performance, or compliance promises appear in the UI; the README names the missing privacy protections.
- R-37 PASS: the user's brief supplies direction; DESIGN.md declares ENERGY 1 / RHYTHM 1 / MOTION 1.
- R-38 PASS: the chrome uses real page titles/URLs/status; no fabricated product content is shown.

### Purpose gate

- R-01 PASS: no gradients.
- R-04 PASS: Lucide was explicitly requested; icons represent navigation, window actions, page identity, and loading.
- R-06 PASS: system font follows the Windows target; typography rationale is recorded in DESIGN.md.
- R-07 PASS: no decorative background patterns.
- R-08 PASS: arrows implement back/forward actions.
- R-09 PASS: no capsule badges.
- R-10 PASS: no glassmorphism.
- R-12 PASS: no component shadows.
- R-13 PASS: no glows.
- R-14 PASS: no feature cards.
- R-19 PASS: loading animation indicates ongoing navigation and respects reduced motion.
- R-22 PASS: no illustrations.

### Liveliness

- PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 are explicit in DESIGN.md.
- PASS: the sidebar maintains predictable spacing with only loading motion.
- PASS: the native web page is the focal point of the window.
- PASS: whitespace separates navigation, current page, and bottom status.
- PASS: forest green is the deliberate accent on the current-page row and focus.
- PASS: repeated soft green selection and compact typography identify the shell.
- PASS: the design read was declared before implementation and is recorded in DESIGN.md.

### Craftsmanship and quality locks

- C-1 PASS: major choices have a recorded rationale in DESIGN.md.
- C-2 PASS: all shipped controls are exercised by Playwright.
- C-3 PASS: the composition follows browser navigation needs without marketing sections.
- C-4 PASS: supported desktop sizes, loading/error/recovery, keyboard input, and reduced-motion CSS are covered by tests or direct source inspection.
- C-5 PASS: no unsupported claims, statistics, or testimonials are authored.
- R-05 PASS: no template page sections; composition follows the user's browser layout.
- R-11 PASS: consistent small corner radii distinguish buttons, address field, and selected page.
- R-15 PASS: action labels name their behavior, including Back, Forward, Reload, and window controls.
- R-16 PASS: no marketing buzzwords appear.
- R-20 PASS: near-invisible vertical chrome, neutral surface, and restrained green selection follow the Drift brief.
- R-21 PASS: the initial light shell follows the phase boundary; light/dark/system controls remain scheduled for Phase 5 as explicitly requested.
- R-29 PASS: neutral surfaces with one forest-green accent and a functional error red.
- R-30 PASS: no reference-product branding or assets are copied.
- R-31 PASS: palette, layout, type, spacing, icons, and motion reasons are recorded in DESIGN.md.

## Known limits

This is a single-page skeleton. Tabs, persistence, command search, privacy Shields, cookie policy, permission prompts, settings, themes, workspaces, downloads UI, and installers are not yet implemented. Permissions are denied in the interim. New-window links reuse the only content view. The native content inset is rectangular. Browser-wide shortcuts are deferred; Ctrl+L currently applies when the chrome has focus. macOS/Linux are untested. No performance claims or privacy guarantees are made.
