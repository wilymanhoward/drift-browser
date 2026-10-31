# Browser import and popup delivery gate

Direction: the user's Brave screenshot supplies the anchored, grouped menu structure; existing Drift tokens, fonts, surfaces and action icons supply its appearance. The earlier user selection keeps antislop active during implementation. ENERGY 1 / RHYTHM 1 / MOTION 1. Reuse local Settings controls rather than adding a UI dependency; 21st catalog access required authentication, and local 21st review found zero issues in the two new components.

## Hard gate

- PASS R-02/R-17/R-18/R-36/R-38: no em-dash UI copy, fabricated statistics, testimonials or universal compatibility claims. Counts come from actual import results. Disabled incompatible extensions explain their source-store limitation.
- PASS R-03/R-25/R-34: light/dark screenshots inspected; axe WCAG A/AA checks pass for the import page and menu in both themes. The menu stays inside a smaller window and scrolls when necessary. Long permission strings wrap.
- PASS R-23/R-24/R-26: no new logos/assets or ghost destinations. All menu items dispatch existing browser actions; New window creates a real same-profile window. Unavailable extensions and split view are disabled. The import picker lists discovered profiles rather than invented installed-browser entries.
- PASS R-27/R-28/R-32: detection has loading, empty and retry states. Import reports errors, partial failures, duplicate/capacity counts and actual applied preferences. The menu supports arrows/Home/End, initial focus, Escape and outside-click dismissal, and retains visible focus.
- PASS R-33/R-35/R-37: maintained source edited through apply_patch. Build and 82 unit tests pass; import/menu and window/YouTube regression checks pass. Direction follows the user's screenshots and existing DESIGN.md.

## Purpose and craft

- PASS R-01/R-04/R-06/R-07/R-08/R-09/R-10/R-12/R-13/R-14/R-19/R-22: existing colours/font/action-specific icons retained. One menu shadow separates the temporary command surface from the page; no new blur, illustration, badge, animation or decorative motif. Snapshot capture reuses the existing native-view overlay mechanism and is held only while the popup is open.
- PASS C-1/C-2/C-3/C-4/C-5 and R-05/R-11/R-15/R-16/R-20/R-21/R-29/R-30/R-31: the grouped menu and import controls serve actual browser tasks; no marketing template or branding clone. Smaller control radii remain distinct from page surfaces. Settings and main content use the same effective sidebar position, including paired windows.
- PASS liveliness: the deliberate accent marks selection/focus. Group spacing separates creation, library/tools, zoom/sidebar and Settings/close actions. Compact text and familiar action icons retain Drift's browser identity without adding motion.

## Import safety and verification

- PASS source boundaries: trusted-UI IPC accepts an opaque detected-profile ID and explicit selections, never a caller-supplied filesystem path. Discovery is limited to known Windows browser roots; real paths outside those roots are rejected. Firefox/Zen preferences are parsed as data, never executed; bookmarks use read-only SQLite through the existing Node runtime. No new dependency, startup scan or background polling was added.
- PASS merging: bookmarks are added in one saved batch, retain folders within Drift's limits, and preserve existing entries/history. Duplicate/capacity entries are counted. Only recognised preference fields are applied. Fixtures verify persistence after restart and byte-for-byte unchanged Chrome/Firefox source files.
- PASS extensions: only selected source-profile Chrome Web Store IDs can be requested. Packages download into Drift-owned staging outside the autoload directory. The downloaded manifest's current permissions are shown before native loading, file access remains off, identities must match, and background workers start where applicable. Unit tests cover duplicate/cancel/load-failure cleanup and preserving an existing package when committing fails.
- PASS live check: Google Translate 2.0.18 was imported from the store and persisted after restart in an isolated test profile. The actual PC's Brave Personal profile was detected through the public detection API without importing its data or extensions.
- PASS packaged verification: all three import/menu tests pass against the Windows build, including Chrome/Firefox data persistence, unchanged source files, empty scans, private-window restrictions, keyboard navigation, zoom, a smaller viewport and new-window creation. Light/dark axe checks pass; the packaged popup screenshot is in test-results/import-menu-packaged.

Known limits: standard Windows profile locations only; supported preference fields vary by source. Firefox/Zen add-ons, non-store/unpacked extensions and other stores are not transferred. Extension settings/sign-ins are not copied, and Electron lacks some Chrome extension APIs. History/password/cookie migration is outside the selected scope. Existing unrelated repository formatting and old sidebar-pin-test limitations remain documented in delivery-tear-off.md.

Implementation references: Chromium preference structure at https://www.chromium.org/developers/design-documents/preferences/ and theme enums at https://github.com/chromium/chromium/blob/main/chrome/browser/themes/theme_service.h ; Mozilla Places schema at https://searchfox.org/firefox-main/source/toolkit/components/places/Database.cpp . Native SQLite availability was checked in Electron's Node 24 runtime.
