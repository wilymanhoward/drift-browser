# Temporary side preview

Direction: the user's clarified Zen-inspired preview, placed beside the source rather than in a popup. Keep Drift's existing Apple × Zen controls and ENERGY 1 / RHYTHM 1 / MOTION 1.

- Hard Gate PASS: no new assets, colors, animations, dependencies or IPC. Reuse the split divider and labelled 28px close control. Preview mode changes its accessible label to Close preview.
- Purpose Gate PASS: one temporary page supports checking a link while retaining the source and its form state. No sidebar entry or restored tab is created. Further Ctrl-clicks reuse the existing preview rather than adding renderer processes.
- Liveliness PASS: the existing layout, accent, typography and content hierarchy are retained; no extra decorative UI or modal is introduced.
- Craftsmanship PASS: source Electron tests pass for regular/private previews, close via mouse/keyboard, native Escape and Ctrl+W, nested links, source form retention, normal and middle-click behavior, and regular two-tab splits. Tests check close-control geometry in both toolbar/sidebar positions and themes, native page destruction on dismiss, dismissal on tab changes/source close, and session persistence/restart excluding previews. All 82 unit tests and scoped ESLint pass. The existing paired-sidebar and tab tear-off checks also pass.

The preview uses the window's existing sandbox, session partition, permission handling, Shields, download and extension tracking. Preview history/site storage follows the window's privacy settings; temporary preview does not imply private browsing. Page listeners are detached before release, and preview pages cannot sleep or tear off as ordinary tabs.

Validation is on Windows. Sites that override native link behavior may intercept the shortcut. The installer is rebuilt separately; no automatic installation into the user's profile is performed.

Packaged validation: both regular/private preview tests pass against `release/win-unpacked/Drift.exe`. The Windows installer has been rebuilt with this behavior. The existing portable artifact was not rebuilt for this revision.
