// Sample data for the Drift redesign draft. Every figure on screen is computed from these rows.
// Verify before publishing: all of it is representative, not a real account.
(() => {
  const workspaces = [
    { id: 'personal', name: 'Personal', tint: '--tint-a', lastUsed: 'Now' },
    { id: 'work', name: 'Work', tint: '--tint-b', lastUsed: 'Today 14:20' },
    { id: 'reading', name: 'Reading', tint: '--tint-c', lastUsed: '9 Nov' },
  ];

  // kind: essential | pinned | today. host is what the URL pill shows.
  const tabs = [
    { id: 't1', ws: 'personal', kind: 'essential', title: 'Mail', host: 'mail.fastmail.com', path: '/inbox' },
    { id: 't2', ws: 'personal', kind: 'essential', title: 'Calendar', host: 'calendar.fastmail.com', path: '/week' },
    { id: 't3', ws: 'personal', kind: 'essential', title: 'GitHub', host: 'github.com', path: '/notifications' },
    { id: 't4', ws: 'personal', kind: 'essential', title: 'Music', host: 'music.apple.com', path: '/library' },
    { id: 't5', ws: 'personal', kind: 'pinned', title: 'Q4 roadmap', host: 'docs.work', path: '/q4-roadmap' },
    { id: 't6', ws: 'personal', kind: 'pinned', title: 'Design review', host: 'figma.com', path: '/file/design-review' },
    { id: 't7', ws: 'personal', kind: 'today', title: 'Continental drift', host: 'en.wikipedia.org', path: '/wiki/Continental_drift' },
    { id: 't8', ws: 'personal', kind: 'today', title: 'Electron BrowserWindow', host: 'electronjs.org', path: '/docs/latest/api/browser-window' },
    { id: 't9', ws: 'personal', kind: 'today', title: 'Train times Leeds to York', host: 'nationalrail.co.uk', path: '/journey/leeds-york' },
    { id: 't10', ws: 'personal', kind: 'today', title: 'Sourdough starter guide', host: 'breadlab.cooking', path: '/starter', audio: true },
    { id: 't11', ws: 'personal', kind: 'today', title: 'Flat 3B lease', host: 'files.drift', path: '/flat-3b-lease.pdf' },
    { id: 't12', ws: 'personal', kind: 'today', title: 'Weather', host: 'metoffice.gov.uk', path: '/forecast/leeds' },
    { id: 'w1', ws: 'work', kind: 'essential', title: 'Mail', host: 'mail.studio.work', path: '/' },
    { id: 'w2', ws: 'work', kind: 'pinned', title: 'Sprint board', host: 'linear.studio.work', path: '/sprint-41' },
    { id: 'w3', ws: 'work', kind: 'today', title: 'Release checklist', host: 'docs.work', path: '/release' },
    { id: 'w4', ws: 'work', kind: 'today', title: 'Pull request 812', host: 'github.com', path: '/drift/pull/812' },
    { id: 'w5', ws: 'work', kind: 'today', title: 'Electron 39 notes', host: 'electronjs.org', path: '/blog/electron-39' },
    { id: 'w6', ws: 'work', kind: 'today', title: 'Crash reports', host: 'errors.studio.work', path: '/drift' },
    { id: 'w7', ws: 'work', kind: 'today', title: 'Team calendar', host: 'calendar.studio.work', path: '/team' },
    { id: 'r1', ws: 'reading', kind: 'today', title: 'The long read', host: 'longform.news', path: '/the-long-read' },
    { id: 'r2', ws: 'reading', kind: 'today', title: 'Plate tectonics', host: 'en.wikipedia.org', path: '/wiki/Plate_tectonics' },
    { id: 'r3', ws: 'reading', kind: 'today', title: 'Field notes', host: 'notes.drift', path: '/field' },
  ];

  const downloads = [
    { id: 'd1', name: 'photos-october.zip', type: 'file-archive', state: 'progress', doneMB: 251.3, totalMB: 412.0, left: 'About 2 min left', source: 'drive.example-cloud.app', started: '17:52' },
    { id: 'd2', name: 'font-pack.zip', type: 'file-archive', state: 'failed', doneMB: 18.6, totalMB: 64.0, source: 'fonts.dev', started: '17:40', error: 'Network error' },
    { id: 'd3', name: 'Drift-Setup-0.2.2.exe', type: 'file', state: 'done', doneMB: 98.2, totalMB: 98.2, source: 'github.com', started: '16:05' },
    { id: 'd4', name: 'quarterly-report.pdf', type: 'file-text', state: 'done', doneMB: 2.4, totalMB: 2.4, source: 'docs.work', started: '11:18' },
    { id: 'd5', name: 'invoice-2291.pdf', type: 'file-text', state: 'done', doneMB: 0.184, totalMB: 0.184, source: 'billing.energy', started: '09:31' },
  ];

  const logins = [
    { id: 'p1', site: 'github.com', user: 'hollis.wren', issue: 'reused', with: 'npmjs.com', lastUsed: '12 Nov', saved: '3 Mar' },
    { id: 'p2', site: 'npmjs.com', user: 'hollis.wren', issue: 'reused', with: 'github.com', lastUsed: '8 Nov', saved: '3 Mar' },
    { id: 'p3', site: 'news.ycombinator.com', user: 'hwren', issue: 'weak', lastUsed: '14 Nov', saved: '19 Jan' },
    { id: 'p4', site: 'mail.fastmail.com', user: 'hollis@fastmail.com', lastUsed: 'Today', saved: '2 Feb' },
    { id: 'p5', site: 'nationalrail.co.uk', user: 'hollis.wren@fastmail.com', lastUsed: 'Today', saved: '30 Apr' },
    { id: 'p6', site: 'figma.com', user: 'hollis@studio.work', lastUsed: 'Yesterday', saved: '11 Jun' },
    { id: 'p7', site: 'billing.energy', user: 'account 30418822', lastUsed: '1 Nov', saved: '6 Aug' },
    { id: 'p8', site: 'bank.example-coop.uk', user: 'customer 5501 2290', lastUsed: '13 Nov', saved: '6 Aug' },
  ];

  const shields = { host: 'en.wikipedia.org', on: true, trackers: 9, ads: 5, cookieBanners: false };

  const extensions = [
    { id: 'e1', name: 'Reader view', version: '2.3.1', on: true, access: 'Can read this site when clicked' },
    { id: 'e2', name: 'JSON formatter', version: '0.9.0', on: true, access: 'Can read all sites' },
    { id: 'e3', name: 'Colour picker', version: '1.4.2', on: true, access: 'No site access' },
    { id: 'e4', name: 'Grammar check', version: '5.0.4', on: false, access: 'Can read all sites' },
  ];

  const update = { current: '0.2.1', next: '0.2.2', sizeMB: 98.2, doneMB: 38.0 };
  const imports = { from: 'Chrome', profile: 'Default', bookmarks: 86, history: 1240, passwords: 8, extensions: 3 };
  const page = { loaded: 0.68, term: 'plate' };
  const trains = [
    { time: '18:04', to: 'York', platform: 16, state: 'On time' },
    { time: '18:22', to: 'York', platform: 16, state: 'On time' },
    { time: '18:37', to: 'York', platform: 15, state: 'Expected 18:41' },
  ];

  const D = { workspaces, tabs, downloads, logins, shields, extensions, update, imports, page, trains };
  D.tabsIn = (ws) => tabs.filter((t) => t.ws === ws);
  D.blocked = () => (shields.on ? shields.trackers + shields.ads : 0);
  D.attention = () => logins.filter((l) => l.issue);
  D.dlRatio = (d) => d.doneMB / d.totalMB;

  // the figures that must agree
  const count = (ws, kind) => tabs.filter((t) => t.ws === ws && (!kind || t.kind === kind)).length;
  console.assert(count('personal') === 12, 'Personal holds 12 tabs');
  console.assert(count('personal', 'essential') + count('personal', 'pinned') + count('personal', 'today') === 12, '4 + 2 + 6 = 12');
  console.assert(count('personal', 'essential') === 4 && count('personal', 'pinned') === 2 && count('personal', 'today') === 6, 'Personal split');
  console.assert(count('work') === 7 && count('reading') === 3 && tabs.length === 22, '12 + 7 + 3 = 22');
  const by = (s) => downloads.filter((d) => d.state === s).length;
  console.assert(downloads.length === 5 && by('done') === 3 && by('progress') === 1 && by('failed') === 1, '5 = 3 + 1 + 1');
  console.assert(Math.round(D.dlRatio(downloads[0]) * 100) === 61, '251.3 / 412.0 = 61%');
  console.assert(logins.length === 8 && D.attention().length === 3, '8 logins, 3 need attention');
  console.assert(logins.filter((l) => l.issue === 'reused').length === 2 && logins.filter((l) => l.issue === 'weak').length === 1, '3 = 2 reused + 1 weak');
  console.assert(D.blocked() === 14, '14 = 9 trackers + 5 ads');
  console.assert(Math.round((update.doneMB / update.sizeMB) * 100) === 39, 'update 38.0 of 98.2 MB');
  console.assert(extensions.filter((e) => e.on).length === 3, '3 of 4 extensions on');

  window.DATA = D;
})();
