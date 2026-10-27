# Drift shell

Phases 1 through 7 follow the user's calm, nearly invisible browser brief.
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
- Light, dark, and system themes preserve the same neutral hierarchy. Muted text and icon/focus colors have measured contrast; custom accents receive a calculated readable button foreground.
- Workspace icons and a narrow selected-tab accent identify the current context without recoloring the whole window. Pinned favicon tiles keep repeated destinations above regular tabs.
- Compact mode keeps only an edge trigger; its temporary sidebar sits over an in-memory page frame. Two native split panes share a narrow, keyboard-adjustable divider.
- Workspace editing and download progress use the existing dialog surface and labelled rows. Pin, panes, compact and download icons describe their actual actions; no new decorative assets are needed.
- Find reserves one narrow row above native content so highlights remain visible and the page stays interactive. Search/printer/magnifier icons map to find, print and zoom actions.
- A 160ms dialog entry marks a temporary surface after an explicit action; reduced motion disables it. Sidebar width changes remain synchronized with native bounds.
- The active tab is the rail's keyboard tab stop; arrows move between tabs. Inputs, selects, textareas and draggable separators retain visible focus.
- The user's minimal-sidebar revision keeps only Settings and Shields in the footer. Secondary tools and zoom live inside a collapsed Browser tools section in Settings; workspace icons appear only with multiple workspaces. Loading status remains available to assistive technology without a visible Ready label. Settings opens over the current page so tool actions retain their browsing target.
