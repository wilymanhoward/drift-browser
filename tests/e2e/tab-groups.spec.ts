import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { chromeWindow } from './helpers';

// Native menus cannot be clicked under test, so the menu Drift builds is
// captured and its items are triggered by label.
async function choose(app: ElectronApplication, ...path: string[]) {
  await expect
    .poll(() =>
      app.evaluate(() => !!(globalThis as unknown as { menu?: unknown }).menu),
    )
    .toBe(true);
  await app.evaluate((_electron, path) => {
    const g = globalThis as unknown as { menu?: Electron.Menu };
    let items = g.menu!.items;
    g.menu = undefined;
    for (const [i, label] of path.entries()) {
      const item = items.find((entry) => entry.label === label)!;
      if (i === path.length - 1) item.click();
      else items = item.submenu!.items;
    }
  }, path);
}

test('tabs can be grouped, colored, folded, renamed and kept', async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const profile = test.info().outputPath('profile');
  const launch = async () => {
    const app = await electron.launch({
      args: ['.', `--user-data-dir=${profile}`],
      env,
    });
    await app.evaluate(({ Menu }) => {
      Menu.prototype.popup = function () {
        (globalThis as unknown as { menu: Electron.Menu }).menu = this;
      };
    });
    return app;
  };
  let app = await launch();
  try {
    let chrome = await chromeWindow(app);
    // Expanded, so group names show; the pin button needs the sidebar unlocked.
    await chrome.evaluate(async () => {
      const current = await window.drift.getState();
      await window.drift.settings({
        ...current.settings,
        lockCollapsed: false,
      });
      await window.drift.sidebar({ pinned: true });
    });
    const state = () => chrome.evaluate(() => window.drift.getState());
    const first = (await state()).activeTabId;
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'duplicate', id }),
      first,
    );
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'duplicate', id }),
      first,
    );
    await expect.poll(async () => (await state()).tabs.length).toBe(3);
    const [a, b, c] = (await state()).tabs.map((t) => t.id);

    // A new group for the first tab, then the third joins it.
    await chrome.evaluate((id) => window.drift.tab({ type: 'menu', id }), a);
    await choose(app, 'Add to group', 'New group');
    await chrome.evaluate((id) => window.drift.tab({ type: 'menu', id }), c);
    await choose(app, 'Add to group', 'Group 1');
    let now = await state();
    expect(now.groups).toEqual([
      expect.objectContaining({
        name: 'Group 1',
        color: 'blue',
        collapsed: false,
      }),
    ]);
    // Grouped tabs are kept side by side.
    expect(now.tabs.map((t) => t.id)).toEqual([a, c, b]);
    const header = chrome.locator('.tab-group button');
    await expect(header).toHaveAccessibleName('Group 1 group, 2 tabs');
    await expect(chrome.locator('.tab-row.grouped')).toHaveCount(2);

    // Color from the header's menu, a new name, then fold it.
    await header.click({ button: 'right' });
    await choose(app, 'Green');
    const group = now.groups[0].id;
    await chrome.evaluate(
      (id) =>
        window.drift.tab({ type: 'group-rename', id, name: '  Research  ' }),
      group,
    );
    await chrome.evaluate((id) => window.drift.tab({ type: 'select', id }), b);
    await header.click();
    now = await state();
    expect(now.groups[0]).toMatchObject({
      name: 'Research',
      color: 'green',
      collapsed: true,
    });
    await expect(chrome.locator('.tab-row.grouped')).toHaveCount(0);
    await expect(chrome.locator('.tab-group-count')).toHaveText('2');
    await app.close();

    // Groups come back after a restart.
    app = await launch();
    chrome = await chromeWindow(app);
    await expect
      .poll(async () => (await state()).groups)
      .toEqual([
        { id: group, name: 'Research', color: 'green', collapsed: true },
      ]);
    // Selecting a tab in a folded group opens the group.
    await chrome.evaluate((id) => window.drift.tab({ type: 'select', id }), a);
    await expect
      .poll(async () => (await state()).groups[0]?.collapsed)
      .toBe(false);
    // Ungrouping removes the group.
    await chrome.evaluate(
      (id) => window.drift.tab({ type: 'group-menu', id }),
      group,
    );
    await choose(app, 'Ungroup');
    await expect.poll(async () => (await state()).groups).toEqual([]);
  } finally {
    await app.close();
  }
});

test('dragging a tab onto a group or its tabs puts it in the group', async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${test.info().outputPath('profile')}`],
    env,
  });
  try {
    await app.evaluate(({ Menu }) => {
      Menu.prototype.popup = function () {
        (globalThis as unknown as { menu: Electron.Menu }).menu = this;
      };
    });
    const chrome = await chromeWindow(app);
    await chrome.evaluate(async () => {
      const current = await window.drift.getState();
      await window.drift.settings({
        ...current.settings,
        lockCollapsed: false,
      });
      await window.drift.sidebar({ pinned: true });
    });
    const state = () => chrome.evaluate(() => window.drift.getState());
    const first = (await state()).activeTabId;
    for (let i = 0; i < 3; i++)
      await chrome.evaluate(
        (id) => window.drift.tab({ type: 'duplicate', id }),
        first,
      );
    await expect.poll(async () => (await state()).tabs.length).toBe(4);
    const [a, b, c, d] = (await state()).tabs.map((t) => t.id);
    await chrome.evaluate((id) => window.drift.tab({ type: 'menu', id }), a);
    await choose(app, 'Add to group', 'New group');
    const group = (await state()).groups[0].id;
    const row = (id: string) => chrome.locator(`.tab-row[data-tab-id="${id}"]`);
    const groupOf = async (id: string) =>
      (await state()).tabs.find((t) => t.id === id)?.groupId;

    // Onto the group's header: joins at the end of the group.
    await row(c).dragTo(chrome.locator('.tab-group button'));
    await expect.poll(() => groupOf(c)).toBe(group);
    // Onto a tab in the group: joins it there.
    await row(d).dragTo(row(a));
    await expect.poll(() => groupOf(d)).toBe(group);
    await expect(chrome.locator('.tab-row.grouped')).toHaveCount(3);
    // Onto an ungrouped tab: leaves the group.
    await row(c).dragTo(row(b));
    await expect.poll(() => groupOf(c)).toBeUndefined();
    await expect(chrome.locator('.tab-group button')).toHaveAccessibleName(
      'Group 1 group, 2 tabs',
    );
    // Every drop stayed in this window.
    expect(
      app.windows().filter((p) => /renderer\/index\.html$/.test(p.url())),
    ).toHaveLength(1);
  } finally {
    await app.close();
  }
});
