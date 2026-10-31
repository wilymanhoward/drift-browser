# Side-by-side sidebar delivery gate

Direction: the user's request puts the right-hand window's sidebar on the right when two Drift windows share a screen. Reuse the existing sidebar design, ENERGY 1 / RHYTHM 1 / MOTION 1, with no new visual surface or assets.

- PASS behavior: adjacent windows on the same display use outer-edge sidebars. Geometry permits small snap gaps and invisible resize-border overlaps; stacked, widely separated and heavily overlapping windows do not qualify.
- PASS persistence: effective position is separate from stored settings. The browser test verifies a right sidebar while the saved position remains left.
- PASS layout: renderer chrome, resize handles, find bar, overlays, compact reveal, split panes, native page bounds and hover-card orientation use the same effective position. The integration test checks the rendered right edge and native page x-coordinate together.
- PASS lifecycle: move, resize, show/hide, minimize/restore, close and display changes update placement. Tests cover moving out/back, hiding/showing and closing the neighbour.
- PASS accessibility and visual gate: existing controls, focus styling, typography, theme colors and accessible names remain unchanged; this is placement behavior with no new assets, copy, motion or controls. Both left and right layouts reuse the browser's established sidebar-position support.
- PASS efficiency: no added timers, dependencies, background animation or page reloads. Placement refresh only relayouts and publishes windows whose effective side changes.
- PASS verification: production build and all 70 unit tests pass; three window-layout/tear-off tests pass against both source and the packaged Drift.exe. Tests use isolated profiles and scripted window placement. ESLint passes for the touched source/tests; Prettier passes for the formatted files in this change.

The graph service was unavailable; the exact main-window, tab-layout, shared-state and renderer paths were read directly. Existing unrelated repository formatting failures and older sidebar-pin test timeouts remain as recorded in delivery-tear-off.md. Hardware snap gestures and mixed-DPI monitor transitions have not been manually tested.
