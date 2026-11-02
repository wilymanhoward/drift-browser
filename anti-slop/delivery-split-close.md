# Split close control

Direction: Drift's existing Apple × Zen controls, ENERGY 1 / RHYTHM 1 / MOTION 1. One quiet close icon above the right pane exits the split while retaining both tabs.

- Hard Gate PASS: labelled native button, existing X action icon and focus treatment, 28px target, existing muted/text/glass colors; no new assets, typefaces, animations or dependencies.
- Purpose Gate PASS: a 32px strip above the right native page view keeps the control reachable; no overlapping web content or extra floating panel. Left page height is preserved.
- Liveliness PASS: unchanged accent, restrained spacing and content hierarchy. The close control appears only during visible split view and follows existing toolbar/Find layout.
- Craftsmanship PASS: 82 unit tests and production build pass. The source Electron test checks mouse and keyboard activation, both sidebar positions, both toolbar layouts, light/dark themes and Find. Native right-pane geometry leaves the button outside the web view. Both tabs remain after closing and ordinary/Ctrl/middle-click link behavior remains covered. Screenshots inspected in `test-results/split-close-source`.

The same Electron interaction test passes against the packaged Windows application. The Windows installer has been rebuilt; the portable artifact has not been rebuilt for this control.

Scope: exit split view, not close a tab. Reuses the existing split action and shared height constant; no polling or renderer privileges added. Windows validation only.
