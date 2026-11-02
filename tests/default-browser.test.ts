import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { externalLink } from '../src/shared/external-links';

const mocks = vi.hoisted(() => ({
  app: { isPackaged: true, isDefaultProtocolClient: vi.fn() },
  run: vi.fn(),
  open: vi.fn(),
}));
vi.mock('electron', () => ({
  app: mocks.app,
  shell: { openExternal: mocks.open },
}));
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
vi.mock('node:util', () => ({ promisify: () => mocks.run }));
import { defaultBrowser } from '../src/main/default-browser';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PORTABLE_EXECUTABLE_DIR', '');
  mocks.app.isPackaged = true;
  mocks.app.isDefaultProtocolClient.mockReturnValue(false);
  mocks.open.mockResolvedValue(undefined);
  mocks.run.mockImplementation(async (_exe, args: string[]) => ({
    stdout: args.includes('Drift')
      ? 'Drift    REG_SZ    Software\\Clients\\StartMenuInternet\\Drift\\Capabilities\r\n'
      : `(Default)    REG_SZ    "${process.execPath}" -- "%1"\r\n`,
  }));
});
afterEach(() => vi.unstubAllEnvs());

it('only extracts valid external HTTP/S addresses without credentials or unsafe schemes', () => {
  expect(
    externalLink(['Drift.exe', '--', 'https://example.com/?a=1&b=2']),
  ).toBe('https://example.com/?a=1&b=2');
  for (const value of [
    'javascript:alert(1)',
    'file:///C:/secret.html',
    'https://user:pass@example.com/',
    'data:text/html,hi',
    '--load-extension=C:/evil',
    'https://example.com/' + 'x'.repeat(8192),
  ])
    expect(externalLink(['Drift.exe', '--', value])).toBeUndefined();
});
it('reads only its own registration and checks both web protocols', async () => {
  expect(await defaultBrowser('status')).toEqual({
    supported: true,
    installed: true,
    isDefault: false,
  });
  mocks.app.isDefaultProtocolClient.mockImplementation(
    (protocol) => protocol === 'http',
  );
  expect((await defaultBrowser('status')).isDefault).toBe(false);
  mocks.app.isDefaultProtocolClient.mockReturnValue(true);
  expect((await defaultBrowser('status')).isDefault).toBe(true);
  expect(
    mocks.run.mock.calls.every(
      ([exe, args, options]) =>
        exe.endsWith('System32\\reg.exe') &&
        args[0] === 'query' &&
        options.windowsHide,
    ),
  ).toBe(true);
});
it('opens the fixed Windows app page with a general settings fallback', async () => {
  mocks.open.mockRejectedValueOnce(new Error('Not supported'));
  await defaultBrowser('open-settings');
  expect(mocks.open.mock.calls.map((call) => call[0])).toEqual([
    'ms-settings:defaultapps?registeredAppUser=Drift',
    'ms-settings:defaultapps',
  ]);
});
it('does not offer a portable/development build or a different installation as default', async () => {
  mocks.app.isPackaged = false;
  expect((await defaultBrowser('status')).installed).toBe(false);
  expect(mocks.run).not.toHaveBeenCalled();
  await expect(defaultBrowser('open-settings')).rejects.toThrow(
    'Install Drift',
  );
  mocks.app.isPackaged = true;
  vi.stubEnv('PORTABLE_EXECUTABLE_DIR', 'C:/portable');
  expect((await defaultBrowser('status')).installed).toBe(false);
  vi.stubEnv('PORTABLE_EXECUTABLE_DIR', '');
  mocks.run.mockResolvedValue({
    stdout: '(Default) REG_SZ "C:/different/Drift.exe" -- "%1"',
  });
  expect((await defaultBrowser('status')).installed).toBe(false);
  expect(mocks.open).not.toHaveBeenCalled();
});
it('fails safely on missing registration and rejects untrusted command values', async () => {
  mocks.run.mockRejectedValue(new Error('Missing registry key'));
  expect((await defaultBrowser('status')).installed).toBe(false);
  await expect(defaultBrowser('open-settings')).rejects.toThrow();
  vi.clearAllMocks();
  for (const value of [null, {}, 'https://example.com', 'register'])
    await expect(defaultBrowser(value)).rejects.toThrow('Invalid');
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.open).not.toHaveBeenCalled();
});
it('installer declares only web-link capabilities with quoted commands and removes its own keys', () => {
  const script = readFileSync('build/installer.nsh', 'utf8');
  expect(script).toContain('"http" "DriftURL"');
  expect(script).toContain('"https" "DriftURL"');
  expect(script).toContain('" -- "%1"');
  expect(script).toContain('DeleteRegKey HKCU "Software\\Classes\\DriftURL"');
  expect(script).not.toMatch(
    /UserChoice|HKLM|WriteRegStr HKCU "Software\\Classes\\https?"/,
  );
});
