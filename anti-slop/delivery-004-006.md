# Phases 4–6 delivery gate

2026-10-27. Mode: During implementation, as chosen by the user. Direction: DESIGN.md, personal desktop browser, neutral Windows typography and restrained forest accents. ENERGY 1 / RHYTHM 1 / MOTION 1. No new art assets.

Evidence: production build, ESLint/Prettier, 66 unit tests, nine Electron tests, targeted power/settings follow-ups, inspected Electron captures, and native computer-use inspection of the restarted app, settings/workspace editors and two live split panes. `21st review` reported color-token information and the existing command-input autofocus warning; focus follows an explicit dialog-opening action. Fallback palette declarations and editable workspace accent defaults are intentional.

## Hard gate

- R-02 PASS: no em dashes in renderer/internal UI source (`rg` check).
- R-03 PASS: panels use bounded widths/scrolling, workspace rows wrap, and short-height sidebars scroll. This desktop app enforces a 640px minimum window; phone layouts are outside its target.
- R-17 PASS: counts/progress come from filter matches and DownloadItem bytes; no marketing statistics.
- R-18 PASS: no testimonials or avatars.
- R-23 PASS: requested sidebar/workspace/download navigation uses Lucide symbols and text, with no newly created visual assets.
- R-24 PASS: actions use typed bridge calls; page navigation accepts validated routes.
- R-25 PASS: measured muted text is 6.29:1 light and 7.47:1 dark; focus/icon examples are 6.50:1 and 5.58:1. Arbitrary accent buttons calculate black/white foregrounds. Disabled controls are exempt. Custom user CSS can override defaults.
- R-26 PASS: source review traces each added control to settings, workspace, tab, layout or download handlers; phase tests exercise their flows.
- R-27 PASS: loading and storage/validation errors are visible; empty workspace/download/library states are implemented.
- R-28 PASS: no FAQ.
- R-32 PASS: native dialogs contain focus and close with Escape; tab shortcuts, labelled fields and keyboard split/sidebar resizing are exercised.
- R-33 PASS: features live in maintained TS/TSX/CSS source; build scripts bundle those sources without generated behavioral patches.
- R-34 PASS: settings tests switch light/dark and layout live, and screenshots/native inspection show working themed panels.
- R-35 PASS: app built and launched; recorded tests cover window controls, navigation, settings controls/file actions, Shields exceptions, private windows, workspace CRUD/switching, pins, split resizing, compact reveal, sleeping and download actions. Native device permission grants are not hardware-validation claims.
- R-36 PASS: Shields and README disclose incomplete DOM-cookie isolation and limited fingerprint mitigation; no measured memory/performance or certification claims.
- R-37 PASS: existing DESIGN.md and the user's browser brief supplied direction before implementation.
- R-38 PASS: no invented people, customer data or product statistics; fixtures are confined to tests.

## Purpose gate

- R-01 PASS: no gradients or glows added.
- R-04 PASS: pin, split panes, collapse, downloads, Shields and settings symbols label their actual operations, matching the user's requested Lucide set.
- R-06 PASS: Segoe/system type follows the Windows desktop target; no decorative display or monospace typography.
- R-07 PASS: no background grid or decorative pattern.
- R-08 PASS: arrows indicate real navigation/result destinations only.
- R-09 PASS: no decorative badges or security labels.
- R-10 PASS: no glass surfaces added.
- R-12 PASS: dialog shadow separates temporary input from the page; optional content shadow is an explicit preference.
- R-13 PASS: no glow effects.
- R-14 PASS: essentials tiles contain actual pinned tabs; workspace/download rows expose real records, not feature cards.
- R-19 PASS: no template animation stacks; loading respects reduced motion. Broader motion is phase 7.
- R-22 PASS: no generic illustrations.

## Liveliness

- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 are recorded in DESIGN.md.
- Consistency PASS: quiet chrome, compact rows and limited loading motion match those values.
- Focal point PASS: live web content dominates; an opened editor becomes the temporary focal point.
- Whitespace PASS: editor groups separate appearance, behavior and shortcuts; workspace/download rows keep records scannable.
- Accent PASS: current tab/workspace selection uses one restrained accent; surfaces remain neutral.
- Identity PASS: favicon rail, essentials, edge reveal and central command entry repeat the browser-specific interaction language.
- Design read PASS: the established personal-browser direction was reused, with purposes extended in DESIGN.md.

## Craftsmanship and quality locks

- C-1 PASS: DESIGN.md records the purposes of palette, type, layout, icons, corners and temporary surfaces.
- C-2 PASS: added actions are connected and tested, with disabled states for unavailable operations.
- C-3 PASS: every section edits a requested preference or shows real tabs/workspaces/downloads.
- C-4 PASS: build/tests cover empty/error/restored states and live themes; panels scroll at constrained heights and support keyboard operation.
- C-5 PASS: privacy limits and server-dependent download resume are explicit.
- R-05 PASS: no marketing template sections, fake terminal or decorative card mosaic.
- R-11 PASS: small control corners and configurable native content corners have separate roles; controls are not universally pill shaped.
- R-15 PASS: labels name operations: Create workspace, Save workspace, Apply CSS, Pause, Resume, Show in folder.
- R-16 PASS: no promotional buzzwords.
- R-20 PASS: composition centers native web views with workspace/essential/command controls specific to this browser.
- R-21 PASS: system theme is default, with explicit light/dark choices.
- R-29 PASS: neutral theme tokens plus one user/workspace accent; error color is semantic.
- R-30 PASS: requested browser interaction references are adapted without copied logos/assets.
- R-31 PASS: major visual decisions are documented in DESIGN.md.

Additional non-text check: border colors measure 3.23:1 light and 3.92:1 dark against chrome/panel surfaces, above the 3:1 component requirement. These colors are boundaries, not body text. The full accessibility/performance pass and cross-platform validation remain phase 7; this gate does not claim those are complete.
