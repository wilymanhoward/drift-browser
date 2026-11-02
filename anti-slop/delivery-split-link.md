# Ctrl-click split links

Direction: preserve Drift's existing two-pane layout and ENERGY 1 / RHYTHM 1 / MOTION 1. Ctrl+left-click is a shortcut to the existing split behavior, without adding chrome or effects.

- Hard Gate PASS: no new controls, visual assets, text styles or animation. Existing split divider, focus behavior and tab affordances are reused.
- Purpose Gate PASS: the clicked page stays available while its linked destination opens alongside it. Existing split partners remain available as tabs.
- Liveliness PASS: unchanged Drift styling, content hierarchy and restrained dials; no decorative elements added.
- Craftsmanship PASS: production build, all 82 unit tests, scoped ESLint and the new source/packaged Electron end-to-end test pass. Tests verify nested link content, target-blank links, source form retention, links from a second pane, script-link exclusion, normal clicks and middle-click behavior. Existing live/private tear-off tests pass; the paired-window test timed out once during packaging and passed independently on retry.
- Boundary checks PASS: only existing HTTP/S URL validation and native Chromium window-opening events are used. Middle clicks are excluded using the native mouse button. There is no new renderer IPC, page script, polling loop or dependency.

Limit: pages that prevent normal browser link opening can override their own click behavior. macOS was not manually tested. The interaction creates the same two-pane split as existing Drift commands.
