# Tab tear-off verification

The workspace already contained the live-tab transfer implementation. This request verifies it through the renderer's drag events and extends coverage for single-tab windows and private profiles. No new visual surface, animation, asset or dependency was introduced. Existing DESIGN.md direction and during-implementation mode remain in effect.

- PASS behavior: a drag ending outside its source window reaches the main-process transfer handler. The existing WebContentsView moves to a new window instead of navigating a replacement page.
- PASS retained state: the end-to-end test types into a local page, transfers it out and back, and verifies the input remains intact.
- PASS window lifecycle: dropping inside does not create a window; moving back closes the emptied secondary window; the only tab carries its existing window.
- PASS privacy: private tear-off creates another private window; the ordinary window remains ordinary.
- PASS interaction and visual gate: existing draggable tab rows and reorder/pin behavior are reused. No new controls, copy, icons, layout, motion, colors or visual assets require a separate design direction.
- PASS source checks: production build and 68 unit tests pass. The two tear-off end-to-end tests pass. ESLint and Prettier pass for the edited test and README.
- PASS packaged checks: the same two transfer tests pass against release/win-unpacked/Drift.exe, including retained form input and private-window inheritance.

Broader checks are not clean: both older tabs.spec.ts cases time out; a diagnostic rerun identifies waiting for the sidebar pin control. Repository formatting also reports pre-existing changes in src/main/extensions.ts, src/main/tabs.ts, src/renderer/Extensions.tsx and src/shared/extensions.ts. Those unrelated edits were left intact. Physical mouse release/cancellation and dragging across multiple monitors have not been manually checked.

Run against source with `npx playwright test tests/e2e/tear-off.spec.ts`. Set `DRIFT_TEST_EXECUTABLE` to the absolute packaged Drift.exe path to run the same transfer checks against the built application in isolated profiles.
