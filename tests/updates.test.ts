import { expect, it, vi } from 'vitest';
import { canAutoUpdate, updateCommand } from '../src/main/updates';

vi.mock('electron', () => ({
  app: { isPackaged: false, getVersion: () => '0.2.0' },
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

it('reports status and rejects unknown commands', async () => {
  await expect(updateCommand('status')).resolves.toEqual({
    state: 'unsupported',
    current: '0.2.0',
  });
  // Without a running updater, check and install change nothing.
  await expect(updateCommand('check')).resolves.toMatchObject({
    state: 'unsupported',
  });
  await expect(updateCommand('install')).resolves.toMatchObject({
    state: 'unsupported',
  });
  await expect(updateCommand('nope')).rejects.toThrow();
});
