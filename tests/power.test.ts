import { describe, it, expect } from 'vitest';
import { parseWorkspace, parseDownload } from '../src/shared/power';
import { parseSession } from '../src/main/session';
describe('power feature boundaries', () => {
  it('validates workspace changes and refuses injected fields', () => {
    expect(
      parseWorkspace({
        type: 'save',
        name: 'Work',
        icon: 'W',
        accent: '#445566',
      }).type,
    ).toBe('save');
    for (const input of [
      { type: 'save', name: '', icon: 'W', accent: '#445566' },
      { type: 'save', name: 'Work', icon: 'W', accent: 'red' },
      { type: 'select', id: 'a', partition: 'persist:secret' },
      { type: 'move-tab', id: 'a', tabId: 42 },
    ])
      expect(() => parseWorkspace(input)).toThrow();
    expect(() =>
      parseDownload({ type: 'reveal', id: 'a', path: 'C:/secret' }),
    ).toThrow();
    expect(parseDownload({ type: 'pause', id: 'a' }).type).toBe('pause');
  });
  it('restores pinned workspace tabs and rejects dangling references', () => {
    const session = {
      version: 1,
      tabs: [
        {
          id: 'tab',
          url: 'https://example.com/',
          title: 'Example',
          muted: false,
          workspaceId: 'work',
          pinned: true,
        },
      ],
      activeTabId: 'tab',
      sidebar: { pinned: false, width: 224 },
      workspaces: [{ id: 'work', name: 'Work', icon: 'W', accent: '#445566' }],
      activeWorkspaceId: 'work',
    };
    expect(parseSession(session)).toEqual(session);
    expect(
      parseSession({ ...session, activeWorkspaceId: 'missing' }),
    ).toBeNull();
    expect(
      parseSession({
        ...session,
        tabs: [{ ...session.tabs[0], workspaceId: 'missing' }],
      }),
    ).toBeNull();
    expect(
      parseSession({
        ...session,
        workspaces: [...session.workspaces, ...session.workspaces],
      }),
    ).toBeNull();
  });
});
