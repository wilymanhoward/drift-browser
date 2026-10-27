# Drift shell

Phases 1 through 3 follow the user's calm, nearly invisible browser brief.
Reading this as a personal desktop browser with a soft neutral interface.
ENERGY 1 / RHYTHM 1 / MOTION 1.

- Warm gray chrome keeps attention on the web page; forest green identifies the current page and focus.
- The left sidebar collapses to a 48px favicon rail to prioritize the web page. A 150ms hover delay avoids accidental expansion; pinning and resizing support longer titles and repeated navigation.
- Segoe UI Variable follows Windows typography and remains legible at small sizes, with system fallbacks elsewhere.
- Eight-pixel corners and compact spacing follow the requested understated desktop style.
- Lucide arrows, reload, globe, and window symbols describe their actual actions. No custom visual assets are needed.
- The only animation is a loading indicator; reduced-motion users receive a static indicator with a text status.
- A selected-page row repeats the soft green accent. There are no decorative cards, gradients, shadows, or marketing sections.
- Panel width updates immediately alongside native content bounds, keeping the web page aligned without a CSS-only animation. Broader motion polish belongs to Phase 7.
- The native tab menu exposes secondary actions without filling the rail with extra buttons. Arrow keys, keyboard resizing, and Alt+Up/Down provide alternatives to pointer gestures.
- Only the Drift label is draggable: keeping the controls and their approach area outside Electron's drag region prevents false pointer exits. A 300ms collapse delay tolerates brief pointer departures without moving buttons out from under the user.
- The domain pill opens a centered command dialog, keeping URL entry and suggestions out of the rail. One shadow separates this temporary input surface from the captured page beneath it.
- The internal new tab uses a clock, search field, and real saved favorites as its only focal elements; no feed or fabricated content competes with browsing.
- Dialog search fields receive focus only after an explicit user action opens the dialog. Native dialog semantics keep keyboard focus inside it, and Escape returns focus to the page.
- Named bookmark folders use simple section headings and rows because titles/URLs must remain scannable and editable; they do not need decorative cards.
- Light, dark, and system theme controls belong to Phase 5 as specified in the phased request.
