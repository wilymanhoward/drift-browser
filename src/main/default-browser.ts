import { app, shell } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { DefaultBrowserStatus } from '../shared/default-browser';

const run = promisify(execFile);
async function registryValue(key: string, value?: string) {
  try {
    const { stdout } = await run(
      path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe'),
      ['query', key, ...(value ? ['/v', value] : ['/ve'])],
      { windowsHide: true, timeout: 3000 },
    );
    return stdout.match(/REG_SZ\s+([^\r\n]+)/)?.[1]?.trim();
  } catch {
    return undefined;
  }
}
export async function defaultBrowser(
  command: unknown,
): Promise<DefaultBrowserStatus> {
  if (command !== 'status' && command !== 'open-settings')
    throw new Error('Invalid default browser command.');
  const supported = process.platform === 'win32';
  let installed = false;
  if (supported && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) {
    const [capabilities, launch] = await Promise.all([
      registryValue('HKCU\\Software\\RegisteredApplications', 'Drift'),
      registryValue('HKCU\\Software\\Classes\\DriftURL\\shell\\open\\command'),
    ]);
    installed =
      capabilities?.toLowerCase() ===
        'software\\clients\\startmenuinternet\\drift\\capabilities' &&
      launch?.toLowerCase() === `"${process.execPath}" -- "%1"`.toLowerCase();
  }
  const status = {
    supported,
    installed,
    isDefault:
      installed &&
      app.isDefaultProtocolClient('http') &&
      app.isDefaultProtocolClient('https'),
  };
  if (command === 'open-settings') {
    if (!installed)
      throw new Error('Install Drift with the Windows installer first.');
    try {
      await shell.openExternal(
        'ms-settings:defaultapps?registeredAppUser=Drift',
      );
    } catch {
      await shell.openExternal('ms-settings:defaultapps');
    }
  }
  return status;
}
