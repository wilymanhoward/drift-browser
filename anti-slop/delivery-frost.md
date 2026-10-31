# Frost and Settings delivery gate

Direction: the user's Zen screenshots for Settings and their pasted 21st glass-calendar CSS for home. ENERGY 1 / RHYTHM 1 / MOTION 1. Keep Drift's local clock/search/favorites as the focal point. The calendar, demo hover scaling, dependency instructions and remote photograph are reference material, not requested browser features.

## Hard gate

- PASS R-02: changed interface copy has no em dash.
- PASS R-03: native home layout assertions at 360px and 1000px in light/dark found no horizontal overflow; Settings category/content columns reflow through existing breakpoints.
- PASS R-17/R-18/R-36/R-38: no fabricated content; CPU/private-memory samples are retained in docs/performance-frost-2026-10-28.json with measurement limits.
- PASS R-23/R-24: no external assets, new branding, dead links or invented navigation destinations; categories expose existing preferences requested in the Zen reference.
- PASS R-25: home tint protects contrast over wallpaper. White wallpaper behind dark 70% tint produces at most approximately #586065, against #edf1eb text (over 5:1). Light 80% white tint produces at least #ccc, against #303833 (over 7:1). Existing button/input theme colors retained; light/dark axe checks passed.
- PASS R-26/R-27/R-28: existing search, wallpaper, preferences, tools, empty favorites and validation behavior retained; no FAQ or fake calendar actions.
- PASS R-32: visible focus retained; Settings search, category changes, tab selection, close and Escape covered by browser tests; sidebar remains reachable beside Settings.
- PASS R-33: maintained source changes made directly with apply_patch.
- PASS R-34/R-35: production build, lint, 67 unit tests, settings/tools browser checks pass; prior full suite passed 10 tests before this CSS revision. Native home captures inspected in both themes. Windows installer/portable builds completed; packaged smoke check verified actual 20px home frost, Glass preference, Shields and Browser tools.
- PASS R-37: direction and restrained dials follow the user's references and existing DESIGN.md.

## Purpose gate

- PASS R-01/R-07: static forest/stone backdrop gives frost visible depth without fetching a photograph or running an animation; no grid or glow decorations.
- PASS R-04/R-06/R-08/R-09: existing action-specific icons, Windows typography and search controls retained.
- PASS R-10: exactly one bounded home blur, asserted at runtime. Sidebar, Settings and native desktop have no blur. Glass off uses no backdrop filter.
- PASS R-12/R-13/R-14/R-19/R-22: one home shadow marks the panel boundary; no floating illustrations, decorative badges or new visual assets.

## Liveliness

- PASS: declared low energy/rhythm/motion preserved. Clock/search provide focus; spacing separates date, query and saved favorites. Forest selection and quiet inset surfaces retain Drift's identity. No home animation is running, asserted in the benchmark.

## Craft and consistency

- PASS C-1/C-2/C-3: each surface has a browser purpose; existing real actions reused with no added calendar or framework setup.
- PASS C-4/C-5: light/dark captures and narrow-width assertions pass; opaque, reduced-transparency and forced-colors fallbacks exist. Measurements are local samples, not a hardware guarantee.
- PASS R-05/R-11/R-15/R-16/R-20/R-21/R-29/R-30/R-31: 24px home panel distinguishes the focal surface from smaller controls. User-selected references guide surface treatment; Drift keeps its own content, icons and forest/neutral palette. No marketing sections, generic CTAs or forced theme.
- PASS 21st review: no functional findings; informational literal-color notices cover existing CSS fallbacks and explicitly chosen frost tints. No new dependency is justified.

Verification artifacts: test-results/frost-dark.png, frost-light.png and frost-settings.png; test-results/frost-checks; reproducible scripts/measure-glass.mjs. GPU video memory, OS compositor allocations and long browsing sessions were not measured.
