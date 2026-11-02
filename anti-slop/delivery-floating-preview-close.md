# Floating preview close

Direction: the user's requested circle and X floating over the preview, replacing its reserved header row. Reuse Drift's muted surfaces and X icon. ENERGY 1 / RHYTHM 1 / MOTION 1.

- Hard Gate PASS: one labelled 32px button with keyboard activation and visible focus. Existing icon geometry and surface/text/accent colors are reused; no generated assets, packages or animation added.
- Purpose Gate PASS: both web panes now have the same top and height. A 10px inset separates the control from the preview edge; one small shadow keeps it legible over page content. Closed-shadow styling avoids page CSS collisions without a new renderer, timer or blur.
- Liveliness PASS: one quiet circular control follows the requested shape; Drift's existing layout, typography and selection remain unchanged.
- Craftsmanship PASS: production build and 82 unit tests pass. Electron checks cover regular/private previews, strict CSP, synthetic-click rejection, native close and Escape/Ctrl+W cleanup, source retention and session exclusion. Checks confirm full-height panes, scrolling, zoom compensation, light/dark appearance and a close control on a failed load. Screenshots are in `test-results/floating-preview-source` and `test-results/floating-preview-error`.

Security: the sandboxed preview-only preload exposes no bridge to the website. The main-process listener belongs to that preview's WebContents, requires its main frame and no arguments, and only dismisses that preview. The click handler accepts trusted user events only. Closing or navigating the preview releases/recreates its control with its page.

Scope: the floating treatment applies to temporary previews. Regular two-tab splits retain their existing close row. Windows validation; site scripts that remove the document root or the host can remove page-based controls, while the existing native Escape shortcut remains available.

Packaged checks: both regular/private Electron tests pass against `release/win-unpacked/Drift.exe`, including the strict-CSP, zoom, scroll and failed-load scenarios. The Windows installer was rebuilt; the portable artifact was not rebuilt for this revision.
