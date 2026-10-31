import { describe, expect, it } from 'vitest';
import {
  parseSession,
  parseSidebar,
  parseTabCommand,
} from '../src/main/session';

const saved = () => ({
  version: 1,
  tabs: [
    {
      id: 'tab-1',
      url: 'https://example.com/',
      title: 'Example',
      muted: false,
    },
  ],
  activeTabId: 'tab-1',
  sidebar: { pinned: false, width: 224 },
});
describe('session validation', () => {
  it('restores only validated data', () => {
    expect(parseSession(saved())).toEqual(saved());
  });
  it.each([
    null,
    {},
    { ...saved(), version: 2 },
    { ...saved(), activeTabId: 'missing' },
    { ...saved(), tabs: [] },
    { ...saved(), tabs: [...saved().tabs, ...saved().tabs] },
    { ...saved(), sidebar: { pinned: true, width: 900 } },
    { ...saved(), tabs: [{ ...saved().tabs[0], url: 'file:///C:/secret' }] },
    { ...saved(), tabs: [{ ...saved().tabs[0], url: 'javascript:alert(1)' }] },
    { ...saved(), tabs: [{ ...saved().tabs[0], muted: 'true' }] },
  ])('rejects damaged or unsafe sessions', (value) => {
    expect(parseSession(value)).toBeNull();
  });
});
describe('IPC input validation', () => {
  it('accepts sidebar changes and explicit tab commands', () => {
    expect(parseSidebar({ width: 280, pinned: true })).toEqual({
      width: 280,
      pinned: true,
    });
    expect(parseTabCommand({ type: 'move', id: 'tab-1', index: 0 })).toEqual({
      type: 'move',
      id: 'tab-1',
      index: 0,
    });
    expect(parseTabCommand({ type: 'detach', id: 'tab-1' })).toEqual({
      type: 'detach',
      id: 'tab-1',
    });
  });
  it.each([
    null,
    {},
    { expanded: 'true' },
    { width: NaN },
    { width: 207 },
    { width: 361 },
    { pinned: 1 },
    { expanded: true, unknown: true },
  ])('rejects invalid sidebar payloads', (value) => {
    expect(() => parseSidebar(value)).toThrow();
  });
  it.each([
    null,
    {},
    { type: 'select', id: 3 },
    { type: 'move', id: 'a', index: -1 },
    { type: 'move', id: 'a', index: 1.5 },
    { type: 'erase', id: 'a' },
    { type: ['select'], id: 'a' },
    { type: 'select', id: '' },
    { type: 'close', id: 'a', url: 'https://example.com' },
    { type: 'detach', id: 'a', index: 0 },
  ])('rejects invalid tab payloads', (value) => {
    expect(() => parseTabCommand(value)).toThrow();
  });
});
