# Drift shell

Phases 1 through 7 follow the user's calm, nearly invisible browser brief.
Reading this as a personal desktop browser with a soft neutral interface.
ENERGY 1 / RHYTHM 1 / MOTION 1.

The user's Brave menu reference adds one anchored ☰ browser menu using Drift's existing surfaces, typography, quiet separators and action icons. Group real browser commands with shortcuts, zoom and sidebar controls; keep unsupported features out of the menu. Browser migration belongs in a searchable Settings category with a profile picker, explicit data selections, extension permission details and an import result.

- Warm gray chrome keeps attention on the web page; forest green identifies the current page and focus.
- The left sidebar collapses to a 48px favicon rail to prioritize the web page. A 150ms hover delay avoids accidental expansion; pinning and resizing support longer titles and repeated navigation.
- Segoe UI Variable follows Windows typography and remains legible at small sizes, with system fallbacks elsewhere.
- Eight-pixel corners and compact spacing follow the requested understated desktop style.
- Lucide arrows, reload, globe, and window symbols describe their actual actions. No custom visual assets are needed.
- The only animation is a loading indicator; reduced-motion users receive a static indicator with a text status.
- A selected-page row repeats the soft green accent. No marketing sections compete with browsing.
- Panel width updates immediately alongside native content bounds, keeping the web page aligned without a CSS-only animation. Broader motion polish belongs to Phase 7.
- The native tab menu exposes secondary actions without filling the rail with extra buttons. Arrow keys, keyboard resizing, and Alt+Up/Down provide alternatives to pointer gestures.
- Only the Drift label is draggable: keeping the controls and their approach area outside Electron's drag region prevents false pointer exits. A 300ms collapse delay tolerates brief pointer departures without moving buttons out from under the user.
- The domain pill opens a centered command dialog, keeping URL entry and suggestions out of the rail. One shadow separates this temporary input surface from the captured page beneath it.
- The internal new tab uses a greeting, a search field, and real saved favorites as its only focal elements; no feed or fabricated content competes with browsing.
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
- The user's Zen references move Settings into a full content-area page with a category rail, search, and grouped preferences. Settings remains opaque for legibility and leaves browser tabs reachable.
- The user's supplied 21st glass-calendar reference guides only the home surface: a 24px rounded panel, 20px backdrop blur, subtle light edge, and one elevation shadow around the local clock, search, and favorites. The dark tint is stronger than the sample to preserve text contrast over uploaded wallpapers. No calendar functionality is added.
- One static forest/stone background gives the frost something to sample without a downloaded image. Only the bounded home panel blurs; sidebar and Settings use tinted/solid surfaces. No native acrylic, layered full-page filters, animation loop, or new package is needed. Glass off and reduced transparency use an opaque panel.
- Zen restyle: on Windows 11 and macOS the window uses native acrylic/vibrancy so the desktop shows through the sidebar; elsewhere the gradient backdrop remains. Frosted tokens (`--glass-*`) drive the sidebar, essentials tiles, floating active tab, dialogs, Settings and the new-tab card, and collapse to solid colors when Glass effect is off or reduced transparency is requested.
- Zen Frost refinement: Inter Variable (latin subset, SIL OFL, bundled locally because both CSPs block remote fonts) with the single-storey `cv11` and `ss03` features. A 11/12/13/15px scale, tabular numerals for the clock and statistics, uppercase micro-labels only for workspace and list headings, and 120ms ease-out transitions that reduced-motion users do not receive.

## Apple layer (Safari-style)

- Window controls are macOS traffic lights at the top left (close, minimise, zoom); glyphs appear on hover.
- Type is the system San Francisco face on macOS (`-apple-system`), falling back to Inter on Windows and Linux.
- Neutral Apple greys and hairline (0.5px) edges replace the sage palette; the default accent is system blue `#007aff`. Saved settings still on the old sage default move to blue.
- Toolbar: centred address field with a filled, rounded rect. Sidebar: Finder-style 30px rows, close buttons on hover, plain grey section labels.
- Settings: grouped cards with inset dividers, macOS switches for on/off preferences, filled accent for the current category.
- New tab keeps its layout; the swatches use Apple system colours.

## Apple × Zen (current)

Supersedes the Zen Frost and Apple layers above; `src/renderer/style.css` was rewritten as one stylesheet.

- Slimmer sidebar: 208px expanded and 44px collapsed leave more room for the page. The sidebar header uses 28px buttons and a 4px gap so navigation and window controls fit without clipping; resized custom widths remain available.
- Split view places one quiet 28px close control above the right pane. A 32px strip keeps it reachable above the native web view, follows the toolbar and Find bar, and exits the split without deleting tabs.
- Ctrl-click follows the user's clarified Zen-inspired preview behavior: a temporary page beside the source, with no sidebar entry or session restoration. The existing right-pane close control dismisses this preview; regular two-tab splits still retain both tabs when closed. Further Ctrl-clicks reuse the preview, keeping renderer use bounded to one temporary page.
- The preview close control is now a floating 32px circle with an X, inset 10px from its top-right corner; preview pages occupy the full height without the regular split's reserved control row. A sandboxed isolated preload renders only this control, with no extra renderer, blur or timer. Its dimensions compensate for page zoom, and its closed shadow root isolates its styles from the site.
- Clicking the floating X fades and slides the preview 16px right over 180ms before releasing it; reduced motion dismisses immediately. Motion confirms an explicit close action, with one bounded cleanup timeout and no idle animation loop.
- New-tab greetings vary locally across 12 conversational phrases with no consecutive repeats, following the user's Claude-inspired request while retaining Drift's existing grotesque/italic pairing and search/favourites layout.
- General settings includes one Default browser row with an installed-build Make default action, current status and Windows selection instructions. It uses the existing preference row and text button; no startup prompt or persistent banner is added.

- References: Zen's docs (essentials grid, compact mode, workspaces), Apple's WWDC25 sessions on the new design system and Liquid Glass on Mac (glass only on controls, grouped toolbar capsules, concentric corners, inset sidebars), and Safari 26.
- Window: one tinted backdrop, the accent washing in from the top-left and a warm tint from the bottom-right (`--wallpaper-image`). Over Windows acrylic or macOS vibrancy the base stays translucent. The page is a white card with `--radius` corners and a soft shadow.
- Sidebar rests on the backdrop with no panel. Essentials are a 3-column grid of glass squares; the active tab is a lifted glass row; close buttons appear on hover. Workspaces switch from the footer.
- Toolbar layout setting (`toolbarLayout`):
  - `sidebar` (Zen, default): a back/forward/reload capsule, the window buttons and the address field sit at the top of the sidebar; pages use the full window height.
  - `top` (Safari): a 40px top bar with the navigation capsule, a centred address capsule, the sidebar toggle and the window buttons. `autoHideTopBar` only applies here: the bar appears when the cursor touches the top edge, stays while the cursor is anywhere over it, and leaves about half a second after the cursor does. It slides and fades over 220ms on an ease-out curve, and the page moves with it on the same curve.
- Window buttons are Windows-style minimize, maximize and close (by request, instead of macOS traffic lights): quiet muted glyphs, an 8px rounded hover, and the Windows 11 red `#c42b1c` on close.
- Type: system San Francisco on macOS, Inter elsewhere. Default accent is system indigo `#5856d6`; the earlier defaults migrate to it.
- Settings: grouped white cards on the backdrop colour, filled accent for the current category, macOS switches.
- New tab (after Zen): one greeting line, a floating search field and Favourites, nothing else. No clock and no Privacy Report; blocking totals stay in the Shields panel. Two typefaces, the pairing Zen uses on its site: Bricolage Grotesque for the words and Junicode Italic for the accent ("Where to _next?_"). The search field is an 18px-radius sheet rather than a pill, edge-lit with a long soft shadow, with an arrow button that fills with the accent once there is text. Favourites are tinted glass squares with the letter in the site's colour.
- App icon (`assets/icon/`): a glass globe in the indigo-to-peach backdrop colours, with meridians and a peach orbit drifting around it. `icon.svg` is the large source with a soft shadow; `icon-small.svg` fills the canvas without a shadow so 16 to 64px stay legible. `icon.ico` mixes both (small frames up to 64px, shadowed above) and serves the executable and installer; `icon.png` is the window icon.
