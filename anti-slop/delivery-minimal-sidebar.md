# Minimal sidebar revision

Direction: the user's request to reduce the pictured toolbar and move its actions into Settings. Reused existing React controls, theme tokens and native details/summary. ENERGY 1 / RHYTHM 1 / MOTION 1. No new assets or dependencies. The 21st catalog required authentication; existing local primitives cover this change.

Validation: build, lint and 67 unit tests pass. Nine regressions passed in the first suite; its initial cold-launch window lookup exceeded the test's five-second wait. The browser/window-control, settings and tools tests subsequently all passed in a fresh targeted run. The helper now allows 15 seconds for locating the initial chrome window. Expanded Browser tools passed axe checks in both themes. Screenshots of the simplified rail and expanded Settings were inspected. Tests confirm only two footer buttons, no switcher with one workspace, no extra tab when opening Settings, moved library/reopen actions, and zoom that preserves the Settings dialog and current page.

## Delivery gate

- R-02 PASS: no em dashes added to product copy.
- R-03 PASS: existing constrained-window check passes; tools use two flexible columns in the scrolling settings panel.
- R-17 PASS: zoom is the actual active page value; no invented statistics.
- R-18 PASS: no testimonials.
- R-23 PASS: removing controls and relocating navigation follows the user's explicit request; no art created.
- R-24 PASS: moved actions use existing validated bridge handlers.
- R-25 PASS: existing measured theme tokens are reused; expanded tools have zero axe violations in light/dark checks.
- R-26 PASS: library/reopen paths and zoom actions are exercised through Settings; other moved buttons dispatch their existing supported actions.
- R-27 PASS: existing errors/empty states remain, and unavailable split/reopen/zoom actions are disabled.
- R-28 PASS: no FAQ.
- R-32 PASS: native summary works with keyboard input, buttons retain labels/focus, and status remains accessible without a visible Ready label.
- R-33 PASS: source changes are maintained directly in TSX/TS/CSS.
- R-34 PASS: expanded controls pass both-theme accessibility checks.
- R-35 PASS: production app builds and Electron interactions/captures were exercised.
- R-36 PASS: no new privacy/performance claims.
- R-37 PASS: user supplied the minimal direction; decisions are recorded in DESIGN.md and .21st/design.json.
- R-38 PASS: no fabricated content.
- R-01 PASS: no gradients/glows.
- R-04 PASS: existing Settings/Shields symbols identify those retained footer actions.
- R-06 PASS: existing Windows system type remains.
- R-07 PASS: no background pattern.
- R-08 PASS: no decorative arrows; native disclosure indicates expansion.
- R-09 PASS: no badges.
- R-10 PASS: no glass surfaces.
- R-12 PASS: existing dialog shadow separates its temporary surface from the page.
- R-13 PASS: no glow.
- R-14 PASS: tool labels are operational text rows, not decorative cards.
- R-19 PASS: existing reduced-motion-aware dialog behavior remains; no new animation.
- R-22 PASS: no illustrations.
- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 retain the quiet browser direction.
- Consistency PASS: removing visible tool rows lowers chrome density.
- Focal point PASS: page/tabs remain primary; tools appear on demand.
- Whitespace PASS: removed footer rows return space to tabs.
- Accent PASS: existing selection/focus accent remains.
- Identity PASS: native-page/browser rail composition remains.
- Design read PASS: the user's screenshot and request supplied the specific revision.
- C-1 PASS: secondary controls are hidden to prioritize browsing, with the purpose documented.
- C-2 PASS: existing actions are retained behind a labelled disclosure.
- C-3 PASS: no filler sections added.
- C-4 PASS: keyboard, empty-state disabling, both themes and existing tab workflows are checked.
- C-5 PASS: validation evidence and the cold-start retry are stated accurately.
- R-05 PASS: no template layout added.
- R-11 PASS: existing control radius hierarchy retained.
- R-15 PASS: labels name actual browser operations.
- R-16 PASS: no promotional copy.
- R-20 PASS: the layout follows this browser's requested minimal rail.
- R-21 PASS: system/light/dark remain available.
- R-29 PASS: no added palette colors.
- R-30 PASS: no copied product assets.
- R-31 PASS: footer reduction, conditional switcher and collapsed tool group have explicit purposes in DESIGN.md.

The installed application requires the rebuilt installer to receive this source revision. No live installed-profile files are overwritten during testing. Existing platform/privacy limitations remain in README.
