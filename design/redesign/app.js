// Drift redesign draft: one shell, fourteen hash views, all rendered from data.js.
(() => {
  const D = window.DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';
  const icon = (n, extra = '') => `<svg class="i ${extra}" viewBox="0 0 24 24" aria-hidden="true">${(window.ICONS[n] || []).map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`;
  const fav = (title, size = '') => `<span class="fav ${size}" aria-hidden="true">${esc(title.trim()[0].toUpperCase())}</span>`;
  const mb = (v) => (v < 1 ? `${Math.round(v * 1000)} KB` : `${v.toFixed(1)} MB`);
  const pct = (r) => `${Math.round(r * 100)}%`;
  const notice = '<p class="notice">Sample data</p>';

  const VIEWS = [
    ['browse', 'Browse'], ['new-tab', 'New tab'], ['split', 'Split view'], ['compact', 'Compact mode'], ['menus', 'Menus'],
    ['downloads', 'Downloads'], ['passwords', 'Passwords'], ['shields', 'Shields'], ['extensions', 'Extensions'],
    ['workspaces', 'Workspaces'], ['updates', 'Updates'], ['default-browser', 'Default browser'], ['import', 'Import'], ['settings', 'Settings'],
  ];
  const STATES = [['default', 'Loaded'], ['loading', 'Loading'], ['error', 'Error'], ['empty', 'Empty'], ['insecure', 'Not secure']];
  const AREAS = [
    ['look', 'Look and feel'], ['tabs', 'Tabs and workspaces'], ['privacy', 'Privacy and Shields'], ['passwords', 'Passwords'],
    ['downloads', 'Downloads'], ['search', 'Search'], ['shortcuts', 'Shortcuts'], ['updates', 'Updates'], ['about', 'About'],
  ];
  const AREA_LINES = {
    tabs: 'Unload tabs after 15 minutes in the background, and keep up to 6 tabs awake.',
    privacy: 'Shields blocks trackers and ads on every site unless you turn them off for one.',
    passwords: 'Drift offers to save a password when you sign in, and fills it next time.',
    downloads: 'Files save to your Downloads folder, and Drift asks before opening an .exe.',
    search: 'Google is the search engine for the address bar and the new tab.',
    shortcuts: 'Ctrl+T opens a new tab, Ctrl+L the address bar, Ctrl+F find on page.',
    updates: 'Drift checks for updates once a day and installs them when you restart.',
    about: `Drift ${D.update.current}, an Electron browser.`,
  };
  const BLURBS = {
    t1: 'Inbox, 4 unread.', t2: 'This week: 6 events.', t3: '3 notifications on drift.', t4: 'Library, recently added.',
    t5: 'Q4 roadmap, last edited yesterday.', t6: 'Design review, 12 comments.', t8: 'Create and control browser windows.',
    t10: 'Feed the starter once a day at room temperature.', t11: 'Lease agreement, 14 pages.', t12: 'Leeds: light rain, 9 degrees.',
  };

  const S = {
    route: 'browse', area: 'look', ws: 'personal', active: { personal: 't7', work: 'w3', reading: 'r2' },
    state: 'default', findOpen: true, findIdx: 2, findTerm: D.page.term, zoom: 1, load: 1, editingAddr: false,
    railQuery: '', compact: false, peek: false, open: false, theme: 'light', glass: false, density: 'comfortable',
    autoHide: false, accent: '#5856d6', wallpaper: '', muted: false,
    dlFilter: 'all', dlQuery: '', dlSel: 'd1', pwFilter: 'all', pwQuery: '', pwSel: 'p1', pwShown: false, copied: false,
    splitFocus: 0, splitLeft: 0.5, update: 'ready', importState: 'idle', importDone: 0, importFrom: 'Chrome',
    importPick: { bookmarks: true, history: true, passwords: true, extensions: false }, defaultDone: false, saved: 0,
  };
  const pageTab = () => D.tabs.find((t) => t.id === S.active[S.ws]) || D.tabsIn(S.ws)[0];

  // ---------- article: the representative page ----------
  const ARTICLE = [
    ['p', "Continental drift is the slow movement of Earth's continents across the surface of the planet, a few centimetres a year, about as fast as a fingernail grows. The idea was argued for decades before the evidence of moving plates made it widely accepted."],
    ['p', 'Coastlines that match across oceans, the same fossils on distant shores and bands of magnetised rock on the sea floor all point to the same story: the outer shell of the Earth is broken into plates that carry the continents with them.'],
    ['p', 'Where two plates pull apart, new crust forms along mid-ocean ridges. Where they meet, one plate can sink beneath the other, raising mountains and feeding volcanoes along the plate boundary.'],
    ['h3', 'Plate tectonics'],
    ['p', 'Plate tectonics is the theory that explains this movement. The lithosphere is divided into about fifteen major plates and many smaller ones, each moving on the softer layer beneath it.'],
    ['p', 'The Pacific plate moves north-west at around seven centimetres a year, while the North American plate drifts west more slowly. Where a plate slides past another, as along the San Andreas fault, earthquakes are frequent.'],
    ['p', 'Satellites now track each plate to within millimetres, so the drift once inferred from rocks and fossils can be watched directly. Over the next 250 million years the plates are expected to gather into a single landmass, as the plates did once before.'],
  ];
  const termRe = () => new RegExp(S.findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matchCount = () => (S.findTerm ? ARTICLE.reduce((n, [, t]) => n + (t.match(termRe()) || []).length, 0) : 0);
  console.assert(ARTICLE.reduce((n, [, t]) => n + (t.match(/plate/gi) || []).length, 0) === 14, "'plate' appears 14 times");
  function article(level = 'h2', short = false) {
    let k = 0;
    const mark = (t) => (S.findOpen && S.findTerm ? esc(t).replace(termRe(), (m) => `<mark${k++ === S.findIdx ? ' class="current"' : ''}>${m}</mark>`) : esc(t));
    const parts = (short ? ARTICLE.slice(0, 4) : ARTICLE).map(([tag, t]) => `<${tag}>${mark(t)}</${tag}>`).join('');
    return `<article class="page" style="--zoom:${S.zoom}"><${level} class="page-title">Continental drift</${level}><p class="byline">From a sample encyclopedia article</p>${parts}</article>`;
  }
  function tabPage(t, level = 'h2') {
    if (t.id === 't7') return article(level);
    return `<article class="page"><${level} class="page-title">${esc(t.title)}</${level}><p class="byline">${esc(t.host)}</p><p>${esc(BLURBS[t.id] || 'Opened from ' + t.host + '.')}</p></article>`;
  }

  // ---------- floating layer: menus, popovers, dialogs ----------
  let floating = null;
  function closeFloat(restore = true) {
    if (!floating) return;
    const { el, trigger, scrim } = floating;
    floating = null;
    trigger?.setAttribute('aria-expanded', 'false');
    const done = () => { el.remove(); scrim?.remove(); };
    if (reduce()) done(); else el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.98)' }], { duration: 120, easing: EASE }).onfinish = done;
    if (restore && trigger?.isConnected) trigger.focus();
  }
  function openFloat(html, trigger, { cls = '', align = 'start', dialog = false, focus } = {}) {
    closeFloat(false);
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.innerHTML = html;
    let scrim = null;
    if (dialog) { scrim = document.createElement('div'); scrim.className = 'scrim'; document.body.append(scrim); }
    document.body.append(el);
    if (dialog) { el.style.left = `${Math.max(16, (innerWidth - el.offsetWidth) / 2)}px`; el.style.top = `${Math.max(16, (innerHeight - el.offsetHeight) / 2.4)}px`; }
    else if (trigger) {
      const r = trigger.getBoundingClientRect();
      const x = align === 'end' ? r.right - el.offsetWidth : r.left;
      el.style.left = `${Math.min(Math.max(8, x), innerWidth - el.offsetWidth - 8)}px`;
      el.style.top = `${Math.min(r.bottom + 2, innerHeight - el.offsetHeight - 8)}px`;
      trigger.setAttribute('aria-expanded', 'true');
    }
    if (innerWidth <= 640) el.classList.add('sheet-like');
    floating = { el, trigger, scrim };
    if (!reduce()) el.animate([{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 150, easing: EASE });
    (focus ? el.querySelector(focus) : el.querySelector('[role="menuitem"]:not([aria-disabled="true"]), input, button'))?.focus();
    return el;
  }
  const menuHTML = (items) => `<div class="menu" role="menu">${items.map((it) => (it === '-' ? '<div class="msep" role="separator"></div>' : it.html ? it.html
    : `<button class="mi${it.danger ? ' danger' : ''}" role="menuitem" data-act="${it.act}" ${it.id ? `data-id="${esc(it.id)}"` : ''} ${it.disabled ? 'aria-disabled="true"' : ''} ${it.current ? 'aria-current="page"' : ''}>${it.check !== undefined ? `<span class="ck">${it.check ? icon('check') : ''}</span>` : it.icon ? icon(it.icon) : ''}<span class="label">${esc(it.label)}</span>${it.kbd ? `<kbd>${it.kbd}</kbd>` : ''}</button>`)).join('')}</div>`;
  const openMenu = (items, trigger, align) => openFloat(menuHTML(items), trigger, { align });

  const browserMenu = () => [
    { label: 'New tab', act: 'go', id: 'new-tab', kbd: 'Ctrl+T', icon: 'plus' },
    { label: 'Find on page', act: 'find', kbd: 'Ctrl+F', icon: 'search' },
    { html: `<div class="mzoom"><span class="label">Zoom</span><div class="seg" role="group" aria-label="Zoom"><button data-act="zoom" data-id="-1" aria-label="Zoom out">${icon('minus')}</button><button data-act="zoom" data-id="0" aria-label="Reset zoom">${Math.round(S.zoom * 100)}%</button><button data-act="zoom" data-id="1" aria-label="Zoom in">${icon('plus')}</button></div></div>` },
    '-',
    { label: 'Downloads', act: 'go', id: 'downloads', kbd: 'Ctrl+J', icon: 'download', current: S.route === 'downloads' },
    { label: 'Passwords', act: 'go', id: 'passwords', icon: 'key-round', current: S.route === 'passwords' },
    { label: 'Extensions', act: 'go', id: 'extensions', icon: 'puzzle', current: S.route === 'extensions' },
    { label: 'Workspaces', act: 'go', id: 'workspaces', icon: 'layers', current: S.route === 'workspaces' },
    '-',
    { label: 'Settings', act: 'go', id: 'settings', icon: 'settings', current: S.route === 'settings' },
    { label: 'Check for updates', act: 'go', id: 'updates', icon: 'refresh-cw' },
    { label: 'Set as default browser', act: 'go', id: 'default-browser', icon: 'monitor' },
    { label: 'Import from another browser', act: 'go', id: 'import', icon: 'import' },
  ];
  const todayTabs = () => D.tabsIn(S.ws).filter((t) => t.kind === 'today');
  const sidebarMenu = () => [
    { label: 'Sort Today by title', act: 'sortToday', disabled: todayTabs().length < 2 },
    { label: "Close Today's tabs", act: 'closeToday', disabled: !todayTabs().length },
    { label: S.compact ? 'Pin sidebar' : 'Collapse sidebar', act: 'togglePin' },
    ...D.workspaces.filter((w) => w.id !== S.ws).map((w) => ({ label: `Move Today to ${w.name}`, act: 'moveToday', id: w.id, disabled: !todayTabs().length })),
  ];

  // ---------- shell ----------
  function tabRow(t, isEss) {
    const cur = t.id === S.active[S.ws];
    const loading = cur && S.state === 'loading';
    const crashed = cur && S.state === 'error' && S.route === 'browse';
    if (isEss) return `<button class="ess" data-act="select" data-id="${t.id}" ${cur ? 'aria-current="page"' : ''} title="${esc(t.title)}" aria-label="${esc(t.title)}">${fav(t.title, 'lg')}</button>`;
    return `<div class="tabrow${cur ? ' active' : ''}" data-tab="${t.id}" draggable="true">
      <button class="tab${crashed ? ' crashed' : ''}" data-act="select" data-id="${t.id}" ${cur ? 'aria-current="page"' : ''} title="${esc(t.title)}">${loading ? icon('loader', 'spin') : crashed ? `<span class="warn">${icon('triangle-alert')}</span>` : fav(t.title)}<span class="t-title">${esc(t.title)}</span></button>
      ${t.audio ? `<button class="ib t-audio" data-act="mute" aria-label="${S.muted ? 'Unmute' : 'Mute'} ${esc(t.title)}" aria-pressed="${S.muted}">${icon(S.muted ? 'volume-x' : 'volume-2')}</button>` : ''}
      <button class="ib t-close" data-act="close" data-id="${t.id}" aria-label="Close ${esc(t.title)}">${icon('x')}</button></div>`;
  }
  function renderSidebar() {
    const all = D.tabsIn(S.ws);
    const q = S.railQuery.trim().toLowerCase();
    const hit = (t) => !q || t.title.toLowerCase().includes(q) || t.host.includes(q);
    const empty = S.state === 'empty' && S.route === 'browse';
    const ess = empty ? [] : all.filter((t) => t.kind === 'essential');
    const pinned = empty ? [] : all.filter((t) => t.kind === 'pinned' && hit(t));
    const today = empty ? [] : all.filter((t) => t.kind === 'today' && hit(t));
    const ws = D.workspaces.find((w) => w.id === S.ws);
    const nameTag = S.route === 'browse' ? 'h1' : 'span';
    const shown = ess.filter(hit).length + pinned.length + today.length;
    $('#sidebar').innerHTML = `
      <div class="ws-row"><button class="ws-switch" data-act="wsMenu" aria-haspopup="menu" aria-expanded="false"><img src="../../assets/icon/icon-small.svg" alt="Drift"><${nameTag} class="ws-name">${esc(ws.name)}</${nameTag}>${icon('chevron-down')}</button>
      <button class="ib" data-act="sideMenu" aria-label="Sidebar menu" aria-haspopup="menu" aria-expanded="false">${icon('ellipsis-vertical')}</button></div>
      <div class="rail-search">${icon('search')}<input class="input" id="rail" type="search" placeholder="Search tabs" aria-label="Search tabs" value="${esc(S.railQuery)}"><kbd>${q ? `${shown} of ${all.length}` : 'Ctrl+K'}</kbd></div>
      <div class="side-scroll">
        ${ess.length ? `<div class="essentials" role="list" aria-label="Essentials">${ess.filter(hit).map((t) => tabRow(t, true)).join('')}</div>` : '<div class="drop-well" data-drop="essential">Drag a tab here to keep it</div>'}
        ${pinned.length ? `<p class="group-label">Pinned</p><div class="tablist" data-list="pinned">${pinned.map((t) => tabRow(t)).join('')}</div>` : ''}
        <p class="group-label">Today</p>
        <div class="tablist" data-list="today">${today.map((t) => tabRow(t)).join('')}</div>
        ${q && !shown ? `<p class="side-empty">No tabs match "${esc(S.railQuery)}"</p>` : ''}
        ${!q && !today.length ? `<p class="side-empty">No open tabs in ${esc(ws.name)}</p>` : ''}
        <div class="tabrow new-tab-row"><button class="tab" data-act="go" data-id="new-tab">${icon('plus')}<span class="t-title">New tab</span></button></div>
      </div>
      <div class="side-foot">
        <button class="ib" data-act="togglePin" aria-label="${S.compact ? 'Pin sidebar' : 'Collapse sidebar'}" aria-pressed="${!S.compact}">${icon(S.compact ? 'pin' : 'pin-off')}</button>
        <span class="spacer"></span>
        <button class="draft-pick" data-act="viewsMenu" aria-haspopup="menu" aria-expanded="false" aria-label="Draft views">Views: ${esc(VIEWS.find((v) => v[0] === S.route)[1])} ${icon('chevron-up')}</button>
        <button class="draft-pick" data-act="stateMenu" aria-haspopup="menu" aria-expanded="false" aria-label="Preview state">${esc(STATES.find((s) => s[0] === S.state)[1])} ${icon('chevron-up')}</button>
      </div>
      <div class="resize" tabindex="0" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin="180" aria-valuemax="360" aria-valuenow="${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'))}"></div>`;
  }
  function renderTopbar() {
    const t = pageTab();
    const ntp = S.route === 'new-tab';
    const insecure = S.state === 'insecure';
    const loading = S.state === 'loading' || S.load < 1;
    const blocked = D.blocked();
    const dl = D.downloads.find((d) => d.state === 'progress');
    const circ = 2 * Math.PI * 7;
    const ring = dl ? `<svg class="ring" viewBox="0 0 18 18" aria-hidden="true"><circle class="track" cx="9" cy="9" r="7"/><circle class="fill" cx="9" cy="9" r="7" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - D.dlRatio(dl))}"/></svg>` : icon('download');
    const addr = ntp ? '<span>Search or type a URL</span>' : `${insecure ? '<span class="insecure">Not secure</span>' : ''}<span class="host">${esc(t.host)}</span>${esc(t.path)}`;
    $('#topbar').innerHTML = `
      <div class="nav-cluster">
        <button class="ib menu-btn" data-act="openSide" aria-label="Open sidebar">${icon('panel-left')}</button>
        <button class="ib hide-phone" data-act="togglePin" aria-label="${S.compact ? 'Pin sidebar' : 'Collapse sidebar'}">${icon('panel-left')}</button>
        <button class="ib hide-phone" data-act="back" aria-label="Back">${icon('arrow-left')}</button>
        <button class="ib hide-phone" data-act="fwd" aria-label="Forward">${icon('arrow-right')}</button>
        <button class="ib" data-act="reload" aria-label="Reload">${icon('rotate-cw')}</button>
      </div>
      <div class="url-wrap"><div class="url">
        <button class="ib shield-count" data-act="shields" aria-label="Shields, ${blocked} blocked" aria-haspopup="dialog" aria-expanded="false">${icon('shield')}<span>${blocked}</span></button>
        ${loading ? `<span class="ib" aria-label="Loading" role="img" style="cursor:default">${icon('loader', 'spin')}</span>` : insecure ? `<span class="ib" role="img" aria-label="Not secure" style="color:var(--negative);cursor:default">${icon('triangle-alert')}</span>` : `<span class="ib" role="img" aria-label="Secure connection" style="cursor:default">${icon('lock')}</span>`}
        ${S.editingAddr ? `<input class="addr-input" id="addr" aria-label="Address" value="${esc(ntp ? '' : (insecure ? 'http://' : 'https://') + t.host + t.path)}">` : `<button class="addr" id="addr-btn" data-act="editAddr" aria-label="Address, ${esc(ntp ? 'empty' : t.host + t.path)}">${addr}</button>`}
        <button class="ib${S.starred ? ' on' : ''}" data-act="star" aria-label="${S.starred ? 'Remove bookmark' : 'Bookmark this page'}" aria-pressed="${!!S.starred}">${icon('star')}</button>
      </div></div>
      <div class="right-cluster">
        <button class="ib hide-phone" data-act="go" data-id="split" aria-label="Split view" aria-pressed="${S.route === 'split'}">${icon('columns-2')}</button>
        <button class="ib hide-phone" data-act="extMenu" aria-label="Extensions" aria-haspopup="menu" aria-expanded="false">${icon('puzzle')}</button>
        <button class="ib hide-phone" data-act="go" data-id="downloads" aria-label="Downloads${dl ? `, ${pct(D.dlRatio(dl))} of ${dl.name}` : ''}">${ring}</button>
        <button class="ib" data-act="browserMenu" aria-label="Browser menu" aria-haspopup="menu" aria-expanded="false">${icon('ellipsis-vertical')}${S.update === 'ready' ? '<span class="dot-badge" aria-hidden="true"></span>' : ''}</button>
        <button class="ib winctl" aria-label="Minimise" data-act="noop">${icon('minus')}</button>
        <button class="ib winctl" aria-label="Maximise" data-act="noop">${icon('square')}</button>
        <button class="ib winctl close" aria-label="Close window" data-act="noop">${icon('x')}</button>
      </div>`;
    if (S.editingAddr) { const a = $('#addr'); a.focus(); a.select(); }
  }

  // ---------- list states shared by the panel views ----------
  function listState(kind) {
    if (S.state === 'loading') return `<div aria-busy="true" aria-label="Loading ${kind}">${[0, 1, 2, 3].map(() => '<div class="skel-row"><span class="skeleton" style="width:20px;height:20px"></span><span style="flex:1"><span class="skeleton b" style="display:block;width:40%"></span><span class="skeleton b" style="display:block;width:24%;height:12px;margin-top:6px"></span></span></div>').join('')}</div>`;
    if (S.state === 'error') return `<div class="err" role="alert"><span style="display:flex;gap:8px;align-items:center">${icon('triangle-alert')}Couldn't read the ${kind} list. Last read 17:52.</span><button class="btn text" data-act="setState" data-id="default">Retry</button></div>`;
    return '';
  }
  const titleRow = (h, actions = '', sub = '') => `<div class="title-row"><div><h1>${esc(h)}</h1>${sub ? `<p class="finding">${sub}</p>` : ''}</div><div class="actions"><span class="saved${S.saved ? ' show' : ''}" aria-live="polite">${S.saved ? 'Saved' : ''}</span>${actions}</div></div>`;
  const utabs = (name, opts, cur) => `<div class="utabs" role="tablist" aria-label="${name}">${opts.map(([id, label, n]) => `<button role="tab" data-act="${name}" data-id="${id}" aria-selected="${cur === id}">${label}<span class="count">${n}</span></button>`).join('')}</div>`;

  // ---------- views ----------
  const V = {};
  V.browse = () => {
    const t = pageTab();
    if (S.state === 'empty') return sheet(ntpHTML('h2'));
    if (S.state === 'error') return sheet(`<div class="site-error" role="alert">${icon('triangle-alert')}<h2>This site can't be reached</h2><p>${esc(t.host)} took too long to respond.</p><button class="btn" data-act="setState" data-id="default">Try again</button></div>`);
    const n = matchCount();
    const find = S.findOpen && t.id === 't7' ? `<div class="findbar${S.findTerm && !n ? ' zero' : ''}" role="search"><input id="find" aria-label="Find on page" value="${esc(S.findTerm)}"><span class="count-meta" aria-live="polite">${n ? S.findIdx + 1 : 0} of ${n}</span><button class="ib" data-act="findPrev" aria-label="Previous match" ${n ? '' : 'disabled'}>${icon('chevron-up')}</button><button class="ib" data-act="findNext" aria-label="Next match" ${n ? '' : 'disabled'}>${icon('chevron-down')}</button><button class="ib" data-act="findClose" aria-label="Close find">${icon('x')}</button></div>` : '';
    return sheet(find + tabPage(t), { load: true });
  };
  function ntpHTML(level = 'h1') {
    const tiles = [['Mail', 't1'], ['Calendar', 't2'], ['GitHub', 't3'], ['Wikipedia', 't7'], ['National Rail', 't9'], ['Met Office', 't12']];
    return `<div class="ntp" style="${S.wallpaper ? `--wallpaper-image:url('${S.wallpaper}')` : ''}"><div class="ntp-col${S.wallpaper ? ' on-wall' : ''}">
      <${level} class="greeting">Good evening</${level}>
      <div class="ntp-search">${icon('search')}<input class="input boxed" id="ntp-search" placeholder="Search or type a URL" aria-label="Search or type a URL" autocomplete="off" aria-haspopup="listbox"></div>
      ${S.state === 'empty' ? '<p class="finding" style="text-align:center">Sites you visit often will show here.</p>' : `<div class="tiles">${tiles.map(([n, id]) => `<button class="tile" data-act="select" data-id="${id}">${fav(n, 'xl')}<span>${n}</span></button>`).join('')}</div>`}
    </div></div>`;
  }
  V['new-tab'] = () => sheet(ntpHTML(), { notice: true });
  V.split = () => {
    const panes = [
      `<button class="ib pane-close" data-act="closePane" data-id="0" aria-label="Close pane">${icon('x')}</button>${article('h1', true)}`,
      `<button class="ib pane-close" data-act="closePane" data-id="1" aria-label="Close pane">${icon('x')}</button><article class="page"><h2 class="page-title">Train times Leeds to York</h2><p class="byline">nationalrail.co.uk</p><table class="trains"><thead><tr><th>Departs</th><th>To</th><th class="n">Platform</th><th>Running</th></tr></thead><tbody>${D.trains.map((r) => `<tr><td>${r.time}</td><td>${r.to}</td><td class="n">${r.platform}</td><td>${r.state}</td></tr>`).join('')}</tbody></table></article>`,
    ];
    const order = S.swapped ? [1, 0] : [0, 1];
    const w = (i) => (i === 0 ? S.splitLeft : 1 - S.splitLeft);
    return order.map((p, i) => `<section class="sheet${S.splitFocus === i ? ' focused' : ''}" data-pane="${i}" style="flex-grow:${w(i)}" aria-label="Pane ${i + 1}${S.splitFocus === i ? ', focused' : ''}"><div class="sheet-scroll">${panes[p]}</div>${i === 1 ? notice : ''}</section>${i === 0 ? '<div class="split-gap" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize panes"></div>' : ''}`).join('');
  };
  V.compact = () => sheet(article('h1'));
  V.menus = () => sheet(`<div class="canvas">${titleRow('Menus', '', 'The browser menu and the sidebar menu, as they open.')}<div class="menus-spec"><div><h2>Browser menu</h2><div class="float menu inline">${menuHTML(browserMenu())}</div></div><div><h2>Sidebar menu</h2><div class="float menu inline" style="width:240px">${menuHTML(sidebarMenu())}</div></div></div></div>`, { notice: true });

  V.downloads = () => {
    const all = D.downloads;
    const filt = (d) => (S.dlFilter === 'all' || (S.dlFilter === 'progress' ? d.state === 'progress' || d.state === 'paused' : d.state === 'failed')) && (!S.dlQuery || d.name.toLowerCase().includes(S.dlQuery.toLowerCase()));
    const rows = S.state === 'empty' ? [] : all.filter(filt);
    const n = (f) => (S.state === 'empty' ? 0 : all.filter((d) => (f === 'all' ? true : f === 'progress' ? d.state === 'progress' || d.state === 'paused' : d.state === 'failed')).length);
    const prog = all.find((d) => d.state === 'progress');
    const failed = all.find((d) => d.state === 'failed');
    const finding = S.state === 'empty' ? 'Nothing downloaded today.' : [prog && `${esc(prog.name)} is ${pct(D.dlRatio(prog))} done`, failed && `${esc(failed.name)} failed`].filter(Boolean).join(', and ') + '.';
    const sel = rows.find((d) => d.id === S.dlSel) || rows[0];
    const line2 = (d) => d.state === 'progress' ? `${d.doneMB.toFixed(1)} of ${d.totalMB.toFixed(1)} MB · ${d.left} · ${esc(d.source)}` : d.state === 'paused' ? `Paused at ${d.doneMB.toFixed(1)} of ${d.totalMB.toFixed(1)} MB · ${esc(d.source)}` : d.state === 'failed' ? `${esc(d.error)} at ${mb(d.doneMB)} · ${esc(d.source)}` : `Done · ${mb(d.totalMB)} · ${esc(d.source)}`;
    const acts = (d) => d.state === 'progress' ? `<button class="ib" data-act="dlPause" data-id="${d.id}" aria-label="Pause ${esc(d.name)}">${icon('pause')}</button><button class="ib" data-act="dlCancel" data-id="${d.id}" aria-label="Cancel ${esc(d.name)}">${icon('x')}</button>`
      : d.state === 'paused' ? `<button class="ib" data-act="dlResume" data-id="${d.id}" aria-label="Resume ${esc(d.name)}">${icon('play')}</button>`
      : d.state === 'failed' ? `<span class="pill neg">Failed</span><button class="btn text" data-act="dlRetry" data-id="${d.id}">Retry</button>` : '';
    const list = listState('downloads') || (rows.length ? `<div class="lrows" role="listbox" aria-label="Downloads">${rows.map((d) => `<div class="lrow" role="option" tabindex="0" data-act="dlSel" data-id="${d.id}" aria-selected="${sel && sel.id === d.id}">${icon(d.type)}<div class="body"><div class="l1">${esc(d.name)}</div><div class="l2">${line2(d)}</div>${d.state === 'progress' || d.state === 'paused' ? `<div class="bar" role="progressbar" aria-label="${esc(d.name)}" aria-valuenow="${Math.round(D.dlRatio(d) * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct(D.dlRatio(d))}"></i></div>` : ''}</div><div class="end">${acts(d)}</div></div>`).join('')}</div>`
      : `<p class="empty">${S.dlFilter === 'failed' ? 'No failed downloads today.' : S.dlFilter === 'progress' ? 'Nothing is downloading.' : S.dlQuery ? `No downloads match "${esc(S.dlQuery)}".` : 'No downloads today.'}</p>`);
    const detail = sel && !listState('x') ? `<aside class="detail" aria-label="Download details"><h2>${esc(sel.name)}</h2><dl><div class="kv"><dt>Saved to</dt><dd>Downloads</dd></div><div class="kv"><dt>Size</dt><dd>${mb(sel.totalMB)}</dd></div><div class="kv"><dt>Source</dt><dd>${esc(sel.source)}</dd></div><div class="kv"><dt>Started</dt><dd>${sel.started}</dd></div></dl><div style="margin:8px -6px -6px"><button class="btn" data-act="noop" ${sel.state === 'done' ? '' : 'disabled title="Available when the download finishes"'}>${icon('folder')}Show in folder</button></div></aside>` : '<span></span>';
    return sheet(`<div class="canvas">${titleRow('Downloads', `<button class="btn" data-act="dlClear" ${all.some((d) => d.state === 'done') ? '' : 'disabled'}>Clear finished</button>`, finding)}
      ${utabs('dlFilter', [['all', 'All', n('all')], ['progress', 'In progress', n('progress')], ['failed', 'Failed', n('failed')]], S.dlFilter)}
      <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="dl-q" type="search" placeholder="Search downloads" aria-label="Search downloads" value="${esc(S.dlQuery)}"></div><span class="spacer"></span><span class="count-meta">${rows.length} ${rows.length === 1 ? 'download' : 'downloads'}</span></div>
      <div class="split-2"><div class="list">${list}</div>${detail}</div></div>`, { notice: true });
  };

  V.passwords = () => {
    const all = S.state === 'empty' ? [] : D.logins;
    const rows = all.filter((l) => (S.pwFilter === 'all' || l.issue) && (!S.pwQuery || (l.site + l.user).toLowerCase().includes(S.pwQuery.toLowerCase())));
    const att = all.filter((l) => l.issue).length;
    const sel = rows.find((l) => l.id === S.pwSel) || rows[0];
    const pill = (l) => (l.issue === 'reused' ? '<span class="pill warn">Reused</span>' : l.issue === 'weak' ? '<span class="pill warn">Weak</span>' : '');
    const list = listState('passwords') || (rows.length ? `<div class="lrows" role="listbox" aria-label="Saved logins">${rows.map((l) => `<div class="lrow" role="option" tabindex="0" data-act="pwSel" data-id="${l.id}" aria-selected="${sel && sel.id === l.id}">${fav(l.site, 'lg')}<div class="body"><div class="l1">${esc(l.site)}</div><div class="l2 ink">${esc(l.user)}</div></div><div class="end">${pill(l)}</div></div>`).join('')}</div>`
      : `<p class="empty">${S.pwFilter === 'attention' && all.length ? `All ${all.length} passwords are strong and unique.` : S.pwQuery ? `No logins match "${esc(S.pwQuery)}".` : 'No saved passwords. Drift offers to save one when you sign in.'}</p>`);
    const warn = sel && sel.issue ? `<div class="strip" role="note"><span>${sel.issue === 'reused' ? `This password is also used on ${esc(sel.with)}.` : 'This password is short and easy to guess.'}</span><a class="btn" href="https://${esc(sel.site)}" target="_blank" rel="noopener">Change password</a></div>` : '';
    const detail = sel && !listState('x') ? `<aside class="detail" aria-label="Login details"><h2>${esc(sel.site)}</h2>${warn}<dl>
      <div class="kv"><dt>Username</dt><dd>${esc(sel.user)}</dd></div>
      <div class="kv"><dt>Password</dt><dd><span style="flex:1">${S.pwShown ? 'sample-pass-7Rk2' : '••••••••••••'}</span><button class="ib" data-act="pwShow" aria-label="${S.pwShown ? 'Hide' : 'Show'} password" aria-pressed="${S.pwShown}">${icon(S.pwShown ? 'eye-off' : 'eye')}</button><button class="ib" data-act="pwCopy" aria-label="Copy password">${icon(S.copied ? 'check' : 'copy')}</button><span class="sr-only" aria-live="polite">${S.copied ? 'Copied' : ''}</span></dd></div>
      <div class="kv"><dt>Website</dt><dd>https://${esc(sel.site)}</dd></div><div class="kv"><dt>Last used</dt><dd>${esc(sel.lastUsed)}</dd></div><div class="kv"><dt>Saved</dt><dd>${esc(sel.saved)}</dd></div></dl>
      <div style="margin:8px -6px -6px"><button class="btn text danger" data-act="pwDelete" data-id="${sel.id}">Delete login</button></div></aside>` : '<span></span>';
    return sheet(`<div class="canvas">${titleRow('Passwords', '<button class="btn" data-act="pwAdd">Add login</button>', all.length ? `${att} of ${all.length} logins need attention.` : '')}
      ${utabs('pwFilter', [['all', 'All', all.length], ['attention', 'Needs attention', att]], S.pwFilter)}
      <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="pw-q" type="search" placeholder="Search logins" aria-label="Search logins" value="${esc(S.pwQuery)}"></div><span class="spacer"></span><span class="count-meta">${rows.length} ${rows.length === 1 ? 'login' : 'logins'}</span></div>
      <div class="split-2 pw"><div class="list">${list}</div>${detail}</div></div>`, { notice: true });
  };

  V.shields = () => sheet(tabPage(pageTab()), { after: () => openShields() });
  V.extensions = () => {
    const all = S.state === 'empty' ? [] : D.extensions;
    const on = all.filter((e) => e.on).length;
    const list = listState('extensions') || (all.length ? `<div class="lrows">${all.map((e) => `<div class="lrow" style="cursor:default">${icon('puzzle')}<div class="body"><div class="l1">${esc(e.name)} <span class="count-meta" style="font-weight:400">${e.version}</span></div><div class="l2">${esc(e.access)}</div></div><div class="end">${e.on ? '' : '<span class="pill">Off</span>'}<button class="switch2" role="switch" aria-checked="${e.on}" data-act="extToggle" data-id="${e.id}" aria-label="${esc(e.name)}"></button><button class="ib" data-act="extKebab" data-id="${e.id}" aria-label="More for ${esc(e.name)}" aria-haspopup="menu" aria-expanded="false">${icon('ellipsis-vertical')}</button></div></div>`).join('')}</div>`
      : '<p class="empty">No extensions installed.</p>');
    return sheet(`<div class="canvas">${titleRow('Extensions', '<a class="btn" href="https://chromewebstore.google.com" target="_blank" rel="noopener">Get extensions</a>', all.length ? `${all.length} installed, ${on} on.` : '')}<div style="max-width:760px">${list}</div></div>`, { notice: true });
  };
  V.workspaces = () => {
    const all = S.state === 'empty' ? D.workspaces.filter((w) => w.id === S.ws) : D.workspaces;
    const total = all.reduce((n, w) => n + D.tabsIn(w.id).length, 0);
    const list = listState('workspaces') || `<div class="lrows" role="listbox" aria-label="Workspaces">${all.map((w) => `<div class="lrow one" role="option" tabindex="0" data-act="wsSwitch" data-id="${w.id}" aria-selected="${w.id === S.ws}"><span class="wsym" style="background:var(${w.tint})">${esc(w.name[0])}</span><div class="body"><div class="l1">${esc(w.name)}</div></div><span class="n">${D.tabsIn(w.id).length} tabs</span><span class="count-meta" style="min-width:96px;text-align:right">${w.id === S.ws ? 'Current' : esc(w.lastUsed)}</span><button class="ib" data-act="wsKebab" data-id="${w.id}" aria-label="More for ${esc(w.name)}" aria-haspopup="menu" aria-expanded="false">${icon('ellipsis-vertical')}</button></div>`).join('')}</div>`;
    return sheet(`<div class="canvas">${titleRow('Workspaces', '<button class="btn primary" data-act="wsNew">New workspace</button>', `${total} tabs in ${all.length} ${all.length === 1 ? 'workspace' : 'workspaces'}.`)}<div style="max-width:760px">${list}</div></div>`, { notice: true });
  };
  V.updates = () => sheet(tabPage(pageTab()), { after: () => openUpdates() });
  V['default-browser'] = () => sheet(tabPage(pageTab()), { after: () => openDefault() });
  V.import = () => {
    const I = D.imports;
    const chrome = S.importFrom === 'Chrome';
    const rows = [['bookmarks', 'Bookmarks', I.bookmarks], ['history', 'History', I.history], ['passwords', 'Passwords', I.passwords], ['extensions', 'Extensions', I.extensions]];
    const fmt = (v) => v.toLocaleString('en-GB');
    let panel;
    if (S.state === 'error') panel = `<div class="err" role="alert"><span style="display:flex;gap:8px;align-items:center">${icon('triangle-alert')}Couldn't read ${S.importFrom}'s profile. Close ${S.importFrom} and try again.</span><button class="btn text" data-act="setState" data-id="default">Try again</button></div>`;
    else if (S.state === 'empty' || !chrome) panel = `<p class="empty">No ${S.state === 'empty' ? 'other browsers' : esc(S.importFrom) + ' profile'} found on this PC.</p>`;
    else if (S.importState === 'running') panel = `<p>Importing history, ${fmt(S.importDone)} of ${fmt(I.history)}</p><div class="bar" role="progressbar" aria-label="Import progress" aria-valuenow="${Math.round((S.importDone / I.history) * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(S.importDone / I.history) * 100}%"></i></div>`;
    else if (S.importState === 'done') { const got = rows.filter(([k]) => S.importPick[k] && k !== 'extensions').map(([, l, v]) => `${fmt(v)} ${l.toLowerCase()}`); panel = `<p style="color:var(--positive)">Imported ${got.length ? got.join(', ') : 'nothing'} from Chrome.</p><div style="display:flex;justify-content:flex-end;margin:0 -6px -6px"><button class="btn" data-act="importAgain">Import again</button></div>`; }
    else panel = `${rows.map(([k, l, v]) => `<div class="crow"><button class="check" role="checkbox" aria-checked="${S.importPick[k]}" data-act="importPick" data-id="${k}" aria-label="${l}"></button><span class="label">${l}${k === 'extensions' ? '<span class="count-meta">, opens their store pages</span>' : ''}</span><span class="n">${fmt(v)}</span></div>`).join('')}<div style="display:flex;justify-content:flex-end;margin:0 -6px -6px"><button class="btn primary" data-act="importRun" ${Object.values(S.importPick).some(Boolean) ? '' : 'disabled'}>Import</button></div>`;
    return sheet(`<div class="canvas">${titleRow('Import')}<div class="sec import-grid"><div class="lab"><h2>From ${esc(S.importFrom)}</h2><p>${chrome ? `Profile "${I.profile}": ${fmt(I.bookmarks)} bookmarks, ${fmt(I.history)} history entries, ${I.passwords} passwords, ${I.extensions} extensions.` : 'Choose the browser you used before.'}</p><div style="margin:8px 0 0 -6px"><button class="btn" data-act="importFrom" aria-haspopup="menu" aria-expanded="false">${esc(S.importFrom)} ${icon('chevron-down')}</button></div></div><div class="panel2">${panel}</div></div></div>`, { notice: true });
  };
  V.settings = () => {
    const area = AREAS.find((a) => a[0] === S.area);
    const nav = `<nav class="subnav" aria-label="Settings areas">${AREAS.map(([id, l]) => `<a href="#/settings/${id}" ${id === S.area ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
    const phoneAreas = `<div class="phone-areas" style="margin-bottom:8px"><button class="btn" data-act="areaMenu" aria-haspopup="menu" aria-expanded="false">${esc(area[1])} ${icon('chevron-down')}</button></div>`;
    const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="${act}" data-id="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    const sw = (act, on, label) => `<button class="switch2" role="switch" aria-checked="${on}" data-act="${act}" aria-label="${label}"></button>`;
    let body;
    if (S.area !== 'look') body = `<div class="sec"><div class="lab"><h2>${esc(area[1])}</h2><p>${esc(AREA_LINES[S.area])}</p></div><div class="panel2"><p class="finding" style="margin:0">${esc(AREA_LINES[S.area])}</p></div></div>`;
    else body = `
      <div class="sec"><div class="lab"><h2>Theme</h2><p>Light, dark, black, or follow Windows.</p><div class="mini" aria-hidden="true"><span class="m-tab on" style="top:16%"></span><span class="m-tab" style="top:26%"></span><span class="m-tab" style="top:36%"></span><span class="m-url"></span><span class="m-sheet"></span></div></div>
        <div class="panel2"><div class="prow"><span class="st">Theme</span>${seg('theme', [['light', 'Light'], ['dark', 'Dark'], ['black', 'Black'], ['system', 'System']], S.theme)}</div>
        <div class="prow"><span class="st">Density</span>${seg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']], S.density)}</div></div></div>
      <div class="sec"><div class="lab"><h2>Accent</h2><p>Fills buttons that carry text. Progress and on-states use Ember.</p></div>
        <div class="panel2"><div class="prow"><span class="st">Accent colour</span><span class="accent-field"><span class="chip"></span><input class="input boxed${/^#[0-9a-f]{6}$/i.test(S.accent) ? '' : ' bad'}" id="accent" value="${esc(S.accent)}" aria-label="Accent colour, hex" spellcheck="false"></span></div></div></div>
      <div class="sec"><div class="lab"><h2>Window</h2><p>How the frame around your pages behaves.</p></div>
        <div class="panel2"><div class="prow"><span><span class="st">Glass</span><br><span class="sd">Frosted chrome on supported Windows versions</span></span>${sw('glass', S.glass, 'Glass')}</div>
        <div class="prow"><span><span class="st">Hide the top bar</span><br><span class="sd">It slides in when you point at the top edge or press Ctrl+L</span></span>${sw('autoHide', S.autoHide, 'Hide the top bar')}</div></div></div>
      <div class="sec"><div class="lab"><h2>New tab</h2><p>${S.wallpaper ? 'Your image fills the new tab page.' : 'No wallpaper. The new tab page stays white.'}</p></div>
        <div class="panel2"><div class="prow"><span class="st">Wallpaper</span><span style="display:flex;margin:-6px -6px -6px 0">${S.wallpaper ? '<button class="btn text" data-act="wallClear">Remove</button>' : ''}<button class="btn" data-act="wallPick">Choose image</button></span></div></div></div>
      <div class="sec"><div class="lab"></div><div style="margin-left:-6px"><button class="btn text" data-act="resetLook">Reset look and feel</button></div></div>`;
    return sheet(`<div class="canvas">${titleRow(S.area === 'look' ? 'Settings' : area[1])}${phoneAreas}<div class="settings">${nav}<div>${body}</div></div></div>`);
  };

  function sheet(inner, { load = false, notice: withNotice = true, after } = {}) {
    sheet.after = after;
    const ratio = S.state === 'loading' ? D.page.loaded : S.load;
    const line = load ? `<span class="loadline${ratio >= 1 ? ' done' : ''}" style="transform:scaleX(${ratio})" aria-hidden="true"></span>` : '';
    return `<section class="sheet" aria-label="Page">${line}<div class="sheet-scroll">${inner}</div>${withNotice ? notice : ''}</section>`;
  }

  // ---------- popovers that a view opens ----------
  function openShields(trigger = $('.shield-count')) {
    const sh = D.shields;
    const n = D.blocked();
    const tr = sh.on ? sh.trackers : 0;
    const ad = sh.on ? sh.ads : 0;
    const el = openFloat(`<div role="dialog" aria-labelledby="sh-h"><div class="pop-head"><${S.route === 'shields' ? 'h1' : 'h2 class="ph"'} id="sh-h">Shields</${S.route === 'shields' ? 'h1' : 'h2'}>${`<button class="switch2" role="switch" aria-checked="${sh.on}" data-act="shOn" aria-label="Shields on ${esc(sh.host)}"></button>`}</div>
      <p class="count-meta">${esc(sh.host)}</p>
      <p class="lead${n ? '' : ' zero'}"><b>${n}</b><span>blocked</span></p>
      <div class="stack" role="img" aria-label="${tr} trackers and ${ad} ads blocked">${n ? `<i class="s1" style="flex-grow:${tr}"></i><i class="s2" style="flex-grow:${ad}"></i>` : ''}</div>
      <p class="legend"><span><i class="sw s1"></i>Trackers <b>${tr}</b></span><span><i class="sw s2"></i>Ads <b>${ad}</b></span></p>
      <div class="swrow"><span class="st">Block trackers</span><button class="switch2" role="switch" aria-checked="${sh.on && sh.trackers > 0}" data-act="shTr" aria-label="Block trackers" ${sh.on ? '' : 'disabled'}></button></div>
      <div class="swrow"><span class="st">Block ads</span><button class="switch2" role="switch" aria-checked="${sh.on && sh.ads > 0}" data-act="shAd" aria-label="Block ads" ${sh.on ? '' : 'disabled'}></button></div>
      <div class="swrow"><span class="st">Block cookie banners</span><button class="switch2" role="switch" aria-checked="${sh.cookieBanners}" data-act="shCk" aria-label="Block cookie banners" ${sh.on ? '' : 'disabled'}></button></div>
      <p class="sd count-meta" style="margin-top:8px">If the site looks broken, turn Shields off for ${esc(sh.host)} only.</p>
      <div class="pop-foot"><a class="btn text" href="#/settings/privacy">Shields settings</a></div></div>`, trigger, { cls: 'popover', focus: '.switch2' });
    return el;
  }
  function openUpdates(trigger = $('[data-act="browserMenu"]')) {
    const U = D.update;
    const st = S.state === 'loading' ? 'checking' : S.state === 'error' ? 'failed' : S.state === 'empty' ? 'current' : S.update;
    const h = S.route === 'updates' ? 'h1' : 'h2';
    const body = {
      checking: `<p style="display:flex;gap:8px;align-items:center">${icon('loader', 'spin')}Checking for updates</p>`,
      downloading: `<p>Downloading Drift ${U.next}</p><div class="bar" role="progressbar" aria-label="Update download" aria-valuenow="${Math.round((U.doneMB / U.sizeMB) * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(U.doneMB / U.sizeMB) * 100}%"></i></div><p class="legend" style="justify-content:space-between"><span>${U.doneMB.toFixed(1)} MB</span><span>${U.sizeMB.toFixed(1)} MB</span></p>`,
      ready: `<div class="strip" style="margin:8px 0 0">Drift ${U.next} is ready. Restart to update; your tabs will reopen.</div><div class="pop-foot"><button class="btn" data-act="updLater">Later</button><button class="btn primary" data-act="updRestart">Restart to update</button></div>`,
      current: `<p style="color:var(--positive)">Drift ${U.current} is up to date</p><div class="pop-foot"><button class="btn" data-act="updCheck">Check again</button></div>`,
      failed: `<p>Couldn't check for updates. Last checked today 09:00.</p><div class="pop-foot"><button class="btn" data-act="setState" data-id="default">Try again</button></div>`,
    }[st];
    return openFloat(`<div role="dialog" aria-labelledby="up-h"><${h} id="up-h" class="ph" style="font-size:var(--fs-section);font-weight:600;margin-bottom:8px">Updates</${h}>${body}</div>`, trigger, { cls: 'popover', align: 'end' });
  }
  function openDefault() {
    const body = S.defaultDone
      ? `<p class="ok">Drift is your default browser.</p><div class="pop-foot"><button class="btn primary" data-act="closeFloat">Done</button></div>`
      : `<p>Links from mail, chat and documents will open in Drift. Windows opens its Default apps settings to confirm.</p><div class="pop-foot"><button class="btn" data-act="defaultNo">Not now</button><button class="btn primary" data-act="defaultYes">Make Drift default</button></div>`;
    return openFloat(`<div role="dialog" aria-modal="true" aria-labelledby="db-h"><img src="../../assets/icon/icon-small.svg" alt="Drift"><h1 id="db-h">Make Drift your default browser</h1>${body}</div>`, null, { cls: 'dialog', dialog: true, focus: '.btn.primary' });
  }
  function openPrompt(trigger) {
    const host = 'figma.com';
    openFloat(`<form class="prompt" role="dialog" aria-labelledby="pp-h" data-form="savePw"><h2 class="ph" id="pp-h">Save password for ${host}?</h2>
      <div class="field"><label for="pp-u">Username</label><input class="input boxed" id="pp-u" value="hollis@studio.work" autocomplete="off"></div>
      <div class="field"><label for="pp-p">Password</label><div class="pw"><input class="input boxed" id="pp-p" type="password" value="sample-pass-Fg83" autocomplete="off"><button type="button" class="ib" data-act="ppShow" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div></div>
      <div class="pop-foot"><button type="button" class="btn" data-act="closeFloat">Never for this site</button><button class="btn primary" type="submit">Save</button></div></form>`, trigger, { cls: 'popover', focus: '#pp-u' });
  }
  function confirmDelete(what, onYes) {
    openFloat(`<div role="alertdialog" aria-modal="true" aria-labelledby="cd-h"><h1 id="cd-h" style="font-size:var(--fs-section);font-weight:600">Delete ${esc(what)}?</h1><p>This can't be undone.</p><div class="pop-foot"><button class="btn" data-act="closeFloat">Cancel</button><button class="btn primary" data-act="confirmYes">Delete</button></div></div>`, document.activeElement, { cls: 'dialog', dialog: true, focus: '.btn' });
    confirmDelete.yes = onYes;
  }

  // ---------- render ----------
  function applyTheme() {
    const root = document.documentElement;
    const theme = S.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme;
    if (theme === 'light') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.style.setProperty('--tab-row', S.density === 'compact' ? '30px' : '');
    if (/^#[0-9a-f]{6}$/i.test(S.accent)) root.style.setProperty('--user-accent', S.accent);
  }
  function render() {
    const win = $('#window');
    win.classList.toggle('compact', S.compact);
    win.classList.toggle('peek', S.peek);
    win.classList.toggle('open', S.open);
    win.classList.toggle('autohide', S.autoHide);
    applyTheme();
    renderSidebar();
    renderTopbar();
    const keep = floating && floating.keep;
    if (!keep) closeFloat(false);
    $('#stage').innerHTML = V[S.route]();
    sheet.after?.();
    document.title = `${VIEWS.find((v) => v[0] === S.route)[1]} · Drift redesign draft`;
  }
  // re-render while keeping focus on the element that had it
  function rerender() {
    const a = document.activeElement;
    const key = a && (a.id ? `#${a.id}` : a.dataset.act ? `[data-act="${a.dataset.act}"]${a.dataset.id ? `[data-id="${a.dataset.id}"]` : ''}` : null);
    const sel = a && a.selectionStart;
    render();
    if (key) { const n = $(key); if (n) { n.focus(); if (sel != null && n.setSelectionRange) n.setSelectionRange(sel, sel); } }
  }
  function route() {
    const [, r = 'browse', sub] = location.hash.split('/');
    S.route = VIEWS.some((v) => v[0] === r) ? r : 'browse';
    if (S.route === 'settings') S.area = AREAS.some((a) => a[0] === sub) ? sub : 'look';
    S.compact = S.route === 'compact' ? true : S.route === 'browse' || S.route === 'split' ? S.compact && S.pinnedOff : false;
    S.peek = false; S.open = false; S.editingAddr = false;
    render();
  }
  const go = (r) => { if (location.hash === `#/${r}`) route(); else location.hash = `#/${r}`; };
  const flashSaved = () => { S.saved = Date.now(); rerender(); const t = S.saved; setTimeout(() => { if (S.saved === t) { S.saved = 0; const s = $('.saved'); if (s) { s.classList.remove('show'); s.textContent = ''; } } }, 2000); };

  // FLIP for tab rows: rows keep their identity while others move into the gap
  function flip(mutate) {
    const before = new Map([...document.querySelectorAll('.tabrow[data-tab]')].map((r) => [r.dataset.tab, r.getBoundingClientRect().top]));
    mutate();
    if (reduce()) return;
    document.querySelectorAll('.tabrow[data-tab]').forEach((r) => {
      const was = before.get(r.dataset.tab);
      const now = r.getBoundingClientRect().top;
      if (was == null) r.animate([{ opacity: 0, height: '0px' }, { opacity: 1, height: getComputedStyle(r).height }], { duration: 160, easing: EASE });
      else if (was !== now) r.animate([{ transform: `translateY(${was - now}px)` }, { transform: 'none' }], { duration: 150, easing: EASE });
    });
  }
  function closeTab(id) {
    const list = D.tabsIn(S.ws);
    const i = list.findIndex((t) => t.id === id);
    if (i < 0) return;
    const row = document.querySelector(`.tabrow[data-tab="${id}"]`);
    const doIt = () => flip(() => {
      D.tabs.splice(D.tabs.indexOf(list[i]), 1);
      if (S.active[S.ws] === id) { const rest = D.tabsIn(S.ws); S.active[S.ws] = (rest[i] || rest[i - 1] || {}).id; }
      render();
    });
    if (row && !reduce()) row.animate([{ opacity: 1, height: getComputedStyle(row).height }, { opacity: 0, height: '0px', margin: '0px' }], { duration: 150, easing: EASE }).onfinish = doIt;
    else doIt();
  }
  function moveTab(id, dir) {
    flip(() => {
      const t = D.tabs.find((x) => x.id === id);
      const peers = D.tabs.filter((x) => x.ws === t.ws && x.kind === t.kind);
      const j = peers.indexOf(t) + dir;
      if (j < 0 || j >= peers.length) return;
      const a = D.tabs.indexOf(t), b = D.tabs.indexOf(peers[j]);
      [D.tabs[a], D.tabs[b]] = [D.tabs[b], D.tabs[a]];
      render();
    });
    document.querySelector(`.tab[data-id="${id}"]`)?.focus();
  }
  function simulateLoad() {
    S.load = 0.08; rerender();
    const step = () => { S.load = Math.min(1, S.load + 0.18); const l = $('.loadline'); if (l) { l.style.transform = `scaleX(${S.load})`; l.classList.toggle('done', S.load >= 1); } if (S.load < 1) setTimeout(step, 220); else renderTopbar(); };
    setTimeout(step, 220);
  }
  function tick(fn, ms, until) { const id = setInterval(() => { fn(); if (until()) clearInterval(id); }, ms); }

  // ---------- actions ----------
  const A = {
    noop() {},
    go: (id) => { closeFloat(false); go(id); },
    select(id) {
      const t = D.tabs.find((x) => x.id === id);
      if (!t) return;
      S.ws = t.ws; S.active[t.ws] = id; S.peek = false; S.open = false; S.editingAddr = false;
      if (S.route !== 'browse' && S.route !== 'split' && S.route !== 'compact') { go('browse'); return; }
      rerender();
    },
    close: (id) => closeTab(id),
    mute() { S.muted = !S.muted; rerender(); },
    reload() { if (S.state !== 'default' && S.state !== 'insecure') S.state = 'default'; simulateLoad(); },
    back: () => history.back(),
    fwd: () => history.forward(),
    star() { S.starred = !S.starred; rerender(); },
    editAddr() { S.editingAddr = true; renderTopbar(); },
    togglePin() { S.compact = !S.compact; S.pinnedOff = S.compact; S.peek = false; closeFloat(false); if (S.route === 'compact' && !S.compact) go('browse'); else rerender(); },
    openSide() { S.open = true; rerender(); $('#sidebar .ws-switch')?.focus(); },
    find() { closeFloat(false); S.findOpen = true; if (S.route !== 'browse') go('browse'); else rerender(); setTimeout(() => $('#find')?.focus()); },
    findNext() { const n = matchCount(); if (n) { S.findIdx = (S.findIdx + 1) % n; rerender(); scrollMatch(); } },
    findPrev() { const n = matchCount(); if (n) { S.findIdx = (S.findIdx - 1 + n) % n; rerender(); scrollMatch(); } },
    findClose() { S.findOpen = false; rerender(); $('.sheet-scroll')?.focus(); },
    zoom(id) { S.zoom = id === '0' ? 1 : Math.min(2, Math.max(0.5, Math.round((S.zoom + Number(id) * 0.1) * 10) / 10)); const z = document.querySelector('.mzoom [data-id="0"]'); if (z) z.textContent = `${Math.round(S.zoom * 100)}%`; document.querySelectorAll('.page').forEach((p) => p.style.setProperty('--zoom', S.zoom)); },
    browserMenu(_, el) { openMenu(browserMenu(), el, 'end'); },
    sideMenu(_, el) { openMenu(sidebarMenu(), el, 'end'); },
    extMenu(_, el) { openMenu([...D.extensions.filter((e) => e.on).map((e) => ({ label: `${e.name}`, act: 'noop', icon: 'puzzle' })), '-', { label: 'Manage extensions', act: 'go', id: 'extensions', icon: 'settings' }], el, 'end'); },
    wsMenu(_, el) { openMenu([...D.workspaces.map((w, i) => ({ label: `${w.name}  ·  ${D.tabsIn(w.id).length} tabs`, act: 'wsSwitch', id: w.id, check: w.id === S.ws, kbd: `Ctrl+${i + 1}` })), '-', { label: 'Manage workspaces', act: 'go', id: 'workspaces', icon: 'layers' }], el); },
    viewsMenu(_, el) { openMenu(VIEWS.map(([id, l]) => ({ label: l, act: 'go', id, check: id === S.route })), el, 'end'); },
    stateMenu(_, el) { openMenu(STATES.map(([id, l]) => ({ label: l, act: 'setState', id, check: id === S.state })), el, 'end'); },
    setState(id) { S.state = id; S.load = 1; closeFloat(false); rerender(); },
    wsSwitch(id) { closeFloat(false); S.ws = id; S.railQuery = ''; S.dlSel = S.dlSel; flip(() => rerender()); },
    sortToday() { closeFloat(false); flip(() => { const today = todayTabs().sort((a, b) => a.title.localeCompare(b.title)); const rest = D.tabs.filter((t) => !today.includes(t)); D.tabs.length = 0; D.tabs.push(...rest, ...today); render(); }); },
    closeToday() { closeFloat(false); flip(() => { const ids = new Set(todayTabs().map((t) => t.id)); for (let i = D.tabs.length - 1; i >= 0; i--) if (ids.has(D.tabs[i].id)) D.tabs.splice(i, 1); if (ids.has(S.active[S.ws])) S.active[S.ws] = (D.tabsIn(S.ws)[0] || {}).id; render(); }); },
    moveToday(id) { closeFloat(false); flip(() => { todayTabs().forEach((t) => { t.ws = id; }); S.active[S.ws] = (D.tabsIn(S.ws)[0] || {}).id; render(); }); },
    shields(_, el) { openShields(el); },
    shOn() { D.shields.on = !D.shields.on; renderTopbar(); openShields(); },
    shTr() { D.shields.trackers = D.shields.trackers ? 0 : 9; renderTopbar(); openShields(); $('[data-act="shTr"]', floating.el)?.focus(); },
    shAd() { D.shields.ads = D.shields.ads ? 0 : 5; renderTopbar(); openShields(); $('[data-act="shAd"]', floating.el)?.focus(); },
    shCk() { D.shields.cookieBanners = !D.shields.cookieBanners; openShields(); $('[data-act="shCk"]', floating.el)?.focus(); },
    dlFilter(id) { S.dlFilter = id; rerender(); },
    dlSel(id) { S.dlSel = id; rerender(); },
    dlPause(id) { D.downloads.find((d) => d.id === id).state = 'paused'; rerender(); },
    dlResume(id) { D.downloads.find((d) => d.id === id).state = 'progress'; rerender(); },
    dlCancel(id) { Object.assign(D.downloads.find((d) => d.id === id), { state: 'failed', error: 'Cancelled' }); rerender(); },
    dlRetry(id) {
      const d = Object.assign(D.downloads.find((x) => x.id === id), { state: 'progress', doneMB: 0, left: 'About 1 min left' });
      rerender();
      tick(() => { if (d.state !== 'progress') return; d.doneMB = Math.min(d.totalMB, d.doneMB + d.totalMB / 8); if (d.doneMB >= d.totalMB) d.state = 'done'; if (S.route === 'downloads' || S.route === 'browse') rerender(); }, 400, () => d.state !== 'progress');
    },
    dlClear() { for (let i = D.downloads.length - 1; i >= 0; i--) if (D.downloads[i].state === 'done') D.downloads.splice(i, 1); rerender(); },
    pwFilter(id) { S.pwFilter = id; rerender(); },
    pwSel(id) { S.pwSel = id; S.pwShown = false; S.copied = false; rerender(); },
    pwShow() { S.pwShown = !S.pwShown; rerender(); },
    pwCopy() { navigator.clipboard?.writeText('sample-pass-7Rk2').catch(() => {}); S.copied = true; rerender(); setTimeout(() => { S.copied = false; if (S.route === 'passwords') rerender(); }, 2000); },
    pwDelete(id) { const l = D.logins.find((x) => x.id === id); confirmDelete(`the login for ${l.site}`, () => { D.logins.splice(D.logins.indexOf(l), 1); rerender(); }); },
    pwAdd() { openPrompt($('#addr-btn') || $('.url')); },
    ppShow(_, el) { const p = $('#pp-p'); const show = p.type === 'password'; p.type = show ? 'text' : 'password'; el.setAttribute('aria-pressed', show); el.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`); el.innerHTML = icon(show ? 'eye-off' : 'eye'); },
    extToggle(id) { const e = D.extensions.find((x) => x.id === id); e.on = !e.on; rerender(); },
    extKebab(id, el) { const e = D.extensions.find((x) => x.id === id); openMenu([{ label: e.on ? 'Turn off' : 'Turn on', act: 'extToggle', id }, '-', { label: 'Remove', act: 'extRemove', id, danger: true }], el, 'end'); },
    extRemove(id) { const e = D.extensions.find((x) => x.id === id); confirmDelete(e.name, () => { D.extensions.splice(D.extensions.indexOf(e), 1); rerender(); }); },
    wsKebab(id, el) { openMenu([{ label: 'Switch to', act: 'wsSwitch', id, disabled: id === S.ws }, '-', { label: 'Delete', act: 'wsDelete', id, danger: true, disabled: D.workspaces.length < 2 }], el, 'end'); },
    wsDelete(id) { const w = D.workspaces.find((x) => x.id === id); confirmDelete(`${w.name} and its ${D.tabsIn(id).length} tabs`, () => { D.workspaces.splice(D.workspaces.indexOf(w), 1); for (let i = D.tabs.length - 1; i >= 0; i--) if (D.tabs[i].ws === id) D.tabs.splice(i, 1); if (S.ws === id) S.ws = D.workspaces[0].id; rerender(); }); },
    wsNew() { const n = D.workspaces.length + 1; const tints = ['--tint-a', '--tint-b', '--tint-c']; D.workspaces.push({ id: `ws${n}`, name: `Workspace ${n}`, tint: tints[n % 3], lastUsed: 'Now' }); rerender(); },
    updLater() { closeFloat(); },
    updRestart() { S.update = 'current'; D.update.current = D.update.next; closeFloat(false); go('browse'); },
    updCheck() { S.update = 'checking'; openUpdates(); setTimeout(() => { S.update = 'downloading'; D.update.doneMB = 0; tick(() => { D.update.doneMB = Math.min(D.update.sizeMB, D.update.doneMB + 19.64); if (D.update.doneMB >= D.update.sizeMB) S.update = 'ready'; if (floating && S.route === 'updates') openUpdates(); }, 400, () => S.update === 'ready'); }, 800); },
    defaultYes() { S.defaultDone = true; openDefault(); },
    defaultNo() { closeFloat(false); go('browse'); },
    closeFloat() { closeFloat(); if (S.route === 'default-browser' || S.route === 'updates' || S.route === 'shields') go('browse'); },
    confirmYes() { closeFloat(false); confirmDelete.yes?.(); },
    importPick(id) { S.importPick[id] = !S.importPick[id]; rerender(); },
    importFrom(_, el) { openMenu(['Chrome', 'Edge', 'Arc', 'Firefox'].map((b) => ({ label: b, act: 'importSet', id: b, check: b === S.importFrom })), el); },
    importSet(id) { closeFloat(false); S.importFrom = id; S.importState = 'idle'; rerender(); },
    importRun() { S.importState = 'running'; S.importDone = 0; rerender(); tick(() => { S.importDone = Math.min(D.imports.history, S.importDone + 155); if (S.importDone >= D.imports.history) S.importState = 'done'; if (S.route === 'import') rerender(); }, 160, () => S.importState === 'done'); },
    importAgain() { S.importState = 'idle'; rerender(); },
    theme(id) { S.theme = id; flashSaved(); },
    density(id) { S.density = id; flashSaved(); },
    glass() { S.glass = !S.glass; flashSaved(); },
    autoHide() { S.autoHide = !S.autoHide; flashSaved(); },
    wallPick() { $('#wall-file').click(); },
    wallClear() { S.wallpaper = ''; flashSaved(); },
    resetLook() { Object.assign(S, { theme: 'light', density: 'comfortable', glass: false, autoHide: false, accent: '#5856d6', wallpaper: '' }); document.documentElement.style.removeProperty('--user-accent'); flashSaved(); },
    areaMenu(_, el) { openMenu(AREAS.map(([id, l]) => ({ label: l, act: 'area', id, check: id === S.area })), el); },
    area(id) { closeFloat(false); go(`settings/${id}`); },
    closePane() { go('browse'); },
  };
  function scrollMatch() { $('mark.current')?.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (floating && !e.target.closest('.float') && !(el && floating.trigger === el)) {
      const viewOwned = ['shields', 'updates', 'default-browser'].includes(S.route) && !el;
      closeFloat(false);
      if (viewOwned && S.route !== 'shields') go('browse');
    }
    if (S.open && !e.target.closest('#sidebar') && !e.target.closest('.menu-btn') && !e.target.closest('.float')) { S.open = false; rerender(); }
    if (!el || el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
    if (floating && el === floating.trigger) { closeFloat(); return; }
    const pane = e.target.closest('[data-pane]');
    if (pane && S.splitFocus !== +pane.dataset.pane) S.splitFocus = +pane.dataset.pane;
    A[el.dataset.act]?.(el.dataset.id, el, e);
  });
  document.addEventListener('mousedown', (e) => {
    const pane = e.target.closest('[data-pane]');
    if (pane && S.splitFocus !== +pane.dataset.pane) { S.splitFocus = +pane.dataset.pane; document.querySelectorAll('[data-pane]').forEach((p, i) => p.classList.toggle('focused', i === S.splitFocus)); }
    const row = e.target.closest('.tabrow[data-tab]');
    if (e.button === 1 && row) { e.preventDefault(); closeTab(row.dataset.tab); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.dataset.form === 'savePw') {
      e.preventDefault();
      D.logins.push({ id: `p${Date.now()}`, site: 'figma.com', user: $('#pp-u').value || 'hollis@studio.work', lastUsed: 'Today', saved: 'Today' });
      closeFloat(false); rerender();
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'rail') { S.railQuery = t.value; renderSidebar(); const r = $('#rail'); r.focus(); r.setSelectionRange(t.value.length, t.value.length); }
    if (t.id === 'find') { S.findTerm = t.value; S.findIdx = 0; rerender(); }
    if (t.id === 'dl-q') { S.dlQuery = t.value; rerender(); }
    if (t.id === 'pw-q') { S.pwQuery = t.value; rerender(); }
    if (t.id === 'accent') { S.accent = t.value.trim(); applyTheme(); t.classList.toggle('bad', !/^#[0-9a-f]{6}$/i.test(S.accent)); if (!t.classList.contains('bad')) flashSaved(); }
    if (t.id === 'ntp-search') ntpSuggest(t);
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'wall-file' && e.target.files[0]) { S.wallpaper = URL.createObjectURL(e.target.files[0]); flashSaved(); }
  });
  const SUGGEST = [['continental drift', 'From history'], ['en.wikipedia.org/wiki/Plate_tectonics', 'Bookmark'], ['nationalrail.co.uk', 'Visited today'], ['metoffice.gov.uk/forecast/leeds', 'Visited today'], ['github.com/notifications', 'Essential']];
  function ntpSuggest(input) {
    const q = input.value.trim().toLowerCase();
    if (!q) { closeFloat(false); input.focus(); return; }
    const hits = SUGGEST.filter(([s]) => s.includes(q)).slice(0, 5);
    const items = [...hits.map(([s, why]) => ({ label: `${s}  ·  ${why}`, act: 'ntpGo', id: s })), { label: `Search for ${input.value.trim()}`, act: 'ntpGo', id: input.value.trim(), icon: 'search' }];
    openMenu(items, input);
    floating.el.style.width = `${input.getBoundingClientRect().width}px`;
    input.focus();
  }
  A.ntpGo = () => { closeFloat(false); S.active[S.ws] = 't7'; go('browse'); };

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    const t = e.target;
    if (k === 'Escape') {
      if (floating) { const owned = ['updates', 'default-browser'].includes(S.route); closeFloat(); if (owned) go('browse'); e.preventDefault(); return; }
      if (t.id === 'rail' && S.railQuery) { S.railQuery = ''; renderSidebar(); $('#rail').focus(); return; }
      if (t.id === 'find') { A.findClose(); return; }
      if (t.id === 'addr') { S.editingAddr = false; renderTopbar(); $('#addr-btn')?.focus(); return; }
      if (S.peek) { S.peek = false; rerender(); return; }
      if (S.open) { S.open = false; rerender(); $('.menu-btn')?.focus(); return; }
    }
    if (floating && t.closest('.menu')) {
      const items = [...floating.el.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
      const i = items.indexOf(t);
      const to = k === 'ArrowDown' ? items[(i + 1) % items.length] : k === 'ArrowUp' ? items[(i - 1 + items.length) % items.length] : k === 'Home' ? items[0] : k === 'End' ? items[items.length - 1] : null;
      if (to) { e.preventDefault(); to.focus(); return; }
      if (k === 'Tab') { closeFloat(); }
    }
    if (t.id === 'ntp-search' && k === 'ArrowDown' && floating) { e.preventDefault(); floating.el.querySelector('[role="menuitem"]')?.focus(); return; }
    if (t.id === 'ntp-search' && k === 'Enter') { A.ntpGo(); return; }
    if (t.id === 'find' && k === 'Enter') { e.preventDefault(); (e.shiftKey ? A.findPrev : A.findNext)(); $('#find')?.focus(); return; }
    if (t.id === 'addr' && k === 'Enter') { S.editingAddr = false; renderTopbar(); simulateLoad(); return; }
    if ((k === 'Enter' || k === ' ') && t.matches('[role="option"][data-act], [role="switch"]:not(button)')) { e.preventDefault(); t.click(); return; }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown') && t.matches('.tab[data-id]')) { e.preventDefault(); moveTab(t.dataset.id, k === 'ArrowUp' ? -1 : 1); return; }
    if (t.classList.contains('resize') && (k === 'ArrowLeft' || k === 'ArrowRight')) { setSidebar(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) + (k === 'ArrowLeft' ? -12 : 12)); return; }
    if (t.classList.contains('split-gap') && (k === 'ArrowLeft' || k === 'ArrowRight')) { setSplit(S.splitLeft + (k === 'ArrowLeft' ? -0.04 : 0.04)); return; }
    if (e.ctrlKey && !e.altKey) {
      const ws = { 1: 0, 2: 1, 3: 2 }[k];
      if (ws != null && D.workspaces[ws]) { e.preventDefault(); A.wsSwitch(D.workspaces[ws].id); return; }
      if (k === 'l' || k === 'L') { e.preventDefault(); if (S.autoHide) $('#window').classList.add('reveal'); A.editAddr(); return; }
      if (k === 'f' || k === 'F') { e.preventDefault(); A.find(); return; }
      if (k === 'k' || k === 'K') { e.preventDefault(); if (S.compact) { S.peek = true; rerender(); } $('#rail')?.focus(); return; }
      if (k === 's' || k === 'S') { e.preventDefault(); if (S.compact) { S.peek = !S.peek; rerender(); if (S.peek) $('#sidebar .ws-switch')?.focus(); } return; }
      if (k === 't' || k === 'T') { e.preventDefault(); go('new-tab'); return; }
      if (k === 'j' || k === 'J') { e.preventDefault(); go('downloads'); return; }
    }
    if (e.ctrlKey && e.altKey && S.route === 'split' && (k === 'ArrowLeft' || k === 'ArrowRight')) { S.splitFocus = k === 'ArrowLeft' ? 0 : 1; rerender(); }
    if (k === 'F2' && t.matches('.tab[data-id]')) { e.preventDefault(); renameTab(t.dataset.id); }
  });
  document.addEventListener('dblclick', (e) => { const t = e.target.closest('.tab[data-id]'); if (t) renameTab(t.dataset.id); });
  function renameTab(id) {
    const tab = D.tabs.find((x) => x.id === id);
    const span = document.querySelector(`.tab[data-id="${id}"] .t-title`);
    if (!tab || !span) return;
    span.innerHTML = `<input class="addr-input" style="height:24px" aria-label="Tab title" value="${esc(tab.title)}">`;
    const inp = span.querySelector('input');
    inp.focus(); inp.select();
    inp.addEventListener('click', (ev) => ev.stopPropagation());
    const done = (save) => { if (save && inp.value.trim()) tab.title = inp.value.trim(); rerender(); };
    inp.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
    inp.addEventListener('blur', () => done(true), { once: true });
  }
  document.addEventListener('focusout', (e) => { if (e.target.id === 'addr' && !e.relatedTarget?.closest?.('.url')) { S.editingAddr = false; setTimeout(renderTopbar); } });

  // drag to reorder, drag to Essentials
  let dragId = null;
  document.addEventListener('dragstart', (e) => { const r = e.target.closest?.('.tabrow[data-tab]'); if (!r) return; dragId = r.dataset.tab; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
  document.addEventListener('dragend', () => { document.querySelectorAll('.dragging').forEach((r) => r.classList.remove('dragging')); dragId = null; });
  document.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const well = e.target.closest('.drop-well, .essentials');
    if (well) { e.preventDefault(); well.classList.add('over'); return; }
    const over = e.target.closest('.tabrow[data-tab]');
    if (!over || over.dataset.tab === dragId) return;
    e.preventDefault();
    const a = D.tabs.find((t) => t.id === dragId), b = D.tabs.find((t) => t.id === over.dataset.tab);
    if (a.kind !== b.kind || a.ws !== b.ws) return;
    flip(() => { D.tabs.splice(D.tabs.indexOf(a), 1); D.tabs.splice(D.tabs.indexOf(b) + (e.offsetY > over.offsetHeight / 2 ? 1 : 0), 0, a); renderSidebar(); document.querySelector(`.tabrow[data-tab="${dragId}"]`)?.classList.add('dragging'); });
  });
  document.addEventListener('drop', (e) => {
    const well = e.target.closest('.drop-well, .essentials');
    if (well && dragId) { e.preventDefault(); const t = D.tabs.find((x) => x.id === dragId); t.kind = 'essential'; dragId = null; rerender(); }
  });

  // sidebar resize and split divider
  function setSidebar(px) { const w = Math.min(360, Math.max(180, px)); document.documentElement.style.setProperty('--sidebar-width', `${w}px`); $('.resize')?.setAttribute('aria-valuenow', w); }
  function setSplit(r) { const w = $('#stage').clientWidth; const min = 320 / w; S.splitLeft = Math.min(1 - min, Math.max(min, r)); document.querySelectorAll('#stage > .sheet').forEach((s, i) => { s.style.flexGrow = i === 0 ? S.splitLeft : 1 - S.splitLeft; }); }
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.resize, .split-gap');
    if (!h) return;
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    h.classList.add('drag');
    const stage = $('#stage').getBoundingClientRect();
    const move = (ev) => (h.classList.contains('resize') ? setSidebar(ev.clientX) : setSplit((ev.clientX - stage.left) / stage.width));
    const up = () => { h.classList.remove('drag'); h.removeEventListener('pointermove', move); };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up, { once: true });
  });

  // compact preview and the auto-hidden top bar
  let leaveTimer;
  document.addEventListener('pointerover', (e) => {
    const win = $('#window');
    if (e.target.closest('.hot-left')) { clearTimeout(leaveTimer); if (!S.peek) { S.peek = true; win.classList.add('peek'); } }
    else if (e.target.closest('#sidebar')) clearTimeout(leaveTimer);
    else if (S.peek && !e.target.closest('.float')) { clearTimeout(leaveTimer); leaveTimer = setTimeout(() => { S.peek = false; win.classList.remove('peek'); }, 150); }
    if (S.autoHide) {
      if (e.target.closest('.hot-top, #topbar')) win.classList.add('reveal');
      else if (!$('#topbar').contains(document.activeElement)) win.classList.remove('reveal');
    }
  });

  window.addEventListener('hashchange', route);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S.theme === 'system' && applyTheme());
  route();

  // the fonts this draft must load; a fallback face is a failed check
  document.fonts.load('italic 400 22px "Junicode"').then(() => document.fonts.ready).then(() => {
    const inter = document.fonts.check('500 14px "Inter Variable"');
    const jun = document.fonts.check('italic 400 22px "Junicode"');
    console.assert(inter, 'Inter Variable loaded');
    console.assert(jun, 'Junicode italic loaded');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;font:400 14px "Inter Variable";font-variant-numeric:tabular-nums';
    probe.textContent = '111111';
    document.body.append(probe);
    const tab = probe.offsetWidth;
    probe.style.fontVariantNumeric = 'proportional-nums';
    const prop = probe.offsetWidth;
    probe.remove();
    console.assert(tab !== prop, 'tabular-nums changes the digit widths');
    window.__fonts = { inter, junicode: jun, tabularChanges: tab !== prop };
  });
})();
