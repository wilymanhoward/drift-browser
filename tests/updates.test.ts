import { expect, it, vi } from 'vitest';
import { canAutoUpdate } from '../src/main/updates';

vi.mock('electron', () => ({
  app: { isPackaged: false },
  dialog: {},
  BrowserWindow: {},
}));

it('updates only the installed Windows build', () => {
  expect(canAutoUpdate(true, 'win32', {})).toBe(true);
  expect(canAutoUpdate(false, 'win32', {})).toBe(false);
  expect(canAutoUpdate(true, 'darwin', {})).toBe(false);
  expect(
    canAutoUpdate(true, 'win32', { PORTABLE_EXECUTABLE_DIR: 'D:\\Drift' }),
  ).toBe(false);
});
