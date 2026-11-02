# Greetings and preview close motion

Direction: the user's requested Claude-inspired greeting variety, using Drift's existing typographic layout; the earlier requested close animation remains part of this delivery. ENERGY 1 / RHYTHM 1 / MOTION 1.

- Hard Gate PASS: 12 original short greetings, no fabricated names or personalization, no new assets/dependencies/fonts or remote generation. Existing heading semantics and italic emphasis retained. Close animation is triggered by a trusted user action and skipped for reduced motion.
- Purpose Gate PASS: greeting variety makes a new tab feel fresh without adding content sections. One 180ms opacity/16px slide confirms that the preview is closing; the page is then released and the source fills the space. No idle animation or polling was added.
- Liveliness PASS: existing layout, accent and type pairing retained; phrases remain brief and conversational. The user explicitly requested the motion and copy variation.
- Craftsmanship PASS: 83 unit tests and production build pass. A deterministic repeated-random test verifies greeting diversity and no adjacent repeats. Electron tests create six consecutive tabs, check different headings and usable search/favourites, and check overflow at 720×600. Preview tests observe the actual opacity animation and 180ms duration, check reduced-motion requests produce no animation command, and retain regular/private cleanup, scrolling, zoom and persistence coverage.

Close lifecycle: repeated activation is blocked. Main-frame IPC requires one boolean reduced-motion preference; completion acknowledgements are accepted only while that same preview is closing. A bounded 300ms fallback ensures cleanup if animation completion is lost, and tab changes/disposal clear it. Greeting selection uses a small in-memory index and never reads browser history or calls a service.

Windows validation only. No automatic installation or upload was performed.

Packaged verification: all three greeting/regular-preview/private-preview tests pass against `release/win-unpacked/Drift.exe`. The Windows installer was rebuilt with both changes; the portable executable was not rebuilt for this revision.
