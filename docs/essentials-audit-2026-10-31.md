# Essentials audit

Audited the current source build and `release/win-unpacked/Drift.exe` on Windows using separate disposable profiles. The user's report was that adding a site does not work and does not carry over to another tab. No application source or user profile data was modified during this audit.

## Findings

1. **P1: Home Add site is a dead add flow.** Clicking the tile opens Bookmarks rather than a site editor. On `drift://newtab/`, Bookmark this page is disabled, draft state remains null, and there is no address field or Save button. This reproduces in both builds. The tile is emitted by `src/main/new-tab.ts`; the special navigation in `src/main/tabs.ts` only opens the bookmarks overlay; `src/renderer/Overlay.tsx` initializes its draft to null and disables draft creation for internal pages. This tile currently concerns home favourites, not sidebar Essentials, and therefore cannot serve as an Add Essential action either.

2. **P2: The visible Essentials pin/add control disappears after the first pin.** `src/renderer/App.tsx` renders `.essentials-drop` only when `!hasEssentials`. After pinning one site, the pin button count becomes zero. Adding another Essential by dragging onto the first tile works, as does the Pin tab command, but the visible entry point is no longer available. This is a discoverability problem rather than a storage failure.

3. **Design gap: Essentials are pinned tabs, not independent saved site shortcuts.** Pin toggles only `TabState.pinned`. Closing the tab removes the Essential and does not create a bookmark. An Essential can be reopened through closed-tab history in the same session, but it is not independently saved as a site. Normal session restore preserves pinned tabs that remain open; the audit did not reproduce a failure to carry an existing Essential into a newly opened tab.

4. **Current scope: workspace-local.** The sidebar filters all tabs by the active workspace, including pinned tabs. Switching to another workspace hides the original workspace's Essentials. This is consistent with the documented workspace-tab design, but differs from globally available site shortcuts. Returning to the original workspace shows them again.

## Behaviors that passed

The same eight checks passed in source and packaged runs:

- Pin an already visited site using the visible control.
- Keep the Essential visible after opening another tab.
- Click an Essential to return to its existing page.
- Drag another tab onto an Essential to pin it.
- Reorder two Essentials by drag-and-drop.
- Drag an Essential onto a regular tab to unpin it.
- Preserve the pinned site after closing and relaunching Drift.
- Retain a 32px site-selection target in a collapsed muted Essential.

The audit's three unsuccessful shortcut-expectation checks correspond to the broken Add site entry, workspace-local scope, and removal on tab close. Only the first is a confirmed dead UI flow; the latter two reflect the current pinned-tab model rather than a failed write. The hidden add control is recorded separately as an observation.

## Evidence

- Source results: `test-results/essentials-audit-source-1793458721900/report.json`.
- Packaged results: `test-results/essentials-audit-packaged-1793458730551/report.json`.
- The same directories contain `add-site.png` and `muted-collapsed.png` screenshots.
- Repeat script: `node test-results/audit-essentials.mjs`, optionally setting `DRIFT_TEST_EXECUTABLE` to the packaged executable.

The script exercises real local pages, actual sidebar clicks and drag-and-drop, then restarts the app. It records source/build behavior rather than using the user's browser profile. Reports and fixtures under `test-results` remain ignored by Git.

## Recommended scope for a fix

First repair Add site so it opens an editable address/title form. For sidebar Essentials, provide an explicit, always-available Add Essential action. If Essentials should behave as permanent site shortcuts, store them independently of open tabs and define whether they are global or workspace-local. That design change should be distinct from regular pinned-tab session persistence, which passed this audit.
