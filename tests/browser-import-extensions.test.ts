import { beforeEach, expect, it, vi } from 'vitest';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type { BrowserWindow, Session } from 'electron';

const mocks = vi.hoisted(() => ({
  root: '',
  download: vi.fn(),
  dialog: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => mocks.root },
  dialog: { showMessageBox: mocks.dialog },
  nativeImage: { createEmpty: () => ({ isEmpty: () => true }) },
  session: {},
}));
vi.mock('electron-chrome-extensions', () => ({
  ElectronChromeExtensions: class {},
}));
vi.mock('electron-chrome-web-store', () => ({
  downloadExtension: mocks.download,
  installChromeWebStore: vi.fn(),
  uninstallExtension: vi.fn(),
}));
import { Extensions } from '../src/main/extensions';
const id = 'b'.repeat(32);
const manifest = {
  name: 'Migration fixture',
  version: '1.0',
  manifest_version: 3,
  permissions: ['tabs'],
  host_permissions: ['https://example.com/*'],
  background: { service_worker: 'background.js' },
};
let session: {
  extensions: {
    getExtension: ReturnType<typeof vi.fn>;
    loadExtension: ReturnType<typeof vi.fn>;
    removeExtension: ReturnType<typeof vi.fn>;
  };
  serviceWorkers: { startWorkerForScope: ReturnType<typeof vi.fn> };
};
beforeEach(async () => {
  vi.clearAllMocks();
  await mkdir('test-results', { recursive: true });
  mocks.root = await mkdtemp(path.resolve('test-results/extension-import-'));
  mocks.dialog.mockResolvedValue({ response: 1 });
  mocks.download.mockImplementation(
    async (sourceId: string, staging: string) => {
      const target = path.join(staging, sourceId, '1.0_0');
      await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, 'manifest.json'),
        JSON.stringify(manifest),
      );
      return target;
    },
  );
  session = {
    extensions: {
      getExtension: vi.fn(() => undefined),
      loadExtension: vi.fn(async () => ({ id })),
      removeExtension: vi.fn(),
    },
    serviceWorkers: { startWorkerForScope: vi.fn(async () => undefined) },
  };
});
function importer() {
  const instance = new Extensions(
    session as unknown as Session,
    { open: vi.fn(), close: vi.fn(), select: vi.fn(), window: () => undefined },
    vi.fn(),
  );
  Object.assign(instance, { api: {} });
  return instance;
}
const win = {} as BrowserWindow;
it('asks for actual downloaded permissions, installs to Drift and starts its worker', async () => {
  expect(await importer().importFromStore(id, win)).toBe(true);
  const options = mocks.dialog.mock.calls[0][1];
  expect(options.detail).toContain('tabs');
  expect(options.detail).toContain('https://example.com/*');
  const target = path.join(mocks.root, 'Extensions', id, '1.0_0');
  expect(
    JSON.parse(await readFile(path.join(target, 'manifest.json'), 'utf8')),
  ).toEqual(manifest);
  expect(session.extensions.loadExtension).toHaveBeenCalledWith(target, {
    allowFileAccess: false,
  });
  expect(session.serviceWorkers.startWorkerForScope).toHaveBeenCalledWith(
    `chrome-extension://${id}`,
  );
  expect(await readdir(path.join(mocks.root, 'Import Staging'))).toEqual([]);
});
it('does not download or prompt for an already installed extension', async () => {
  session.extensions.getExtension.mockReturnValue({ id });
  expect(await importer().importFromStore(id, win)).toBe(false);
  expect(mocks.download).not.toHaveBeenCalled();
});
it('cleans cancelled downloads without making them load on restart', async () => {
  mocks.dialog.mockResolvedValue({ response: 0 });
  expect(await importer().importFromStore(id, win)).toBe(false);
  expect(session.extensions.loadExtension).not.toHaveBeenCalled();
  expect(await readdir(path.join(mocks.root, 'Import Staging'))).toEqual([]);
  await expect(
    access(path.join(mocks.root, 'Extensions', id)),
  ).rejects.toThrow();
});
it('removes only this new package if native loading fails', async () => {
  session.extensions.loadExtension.mockRejectedValue(
    new Error('Unsupported API'),
  );
  await expect(importer().importFromStore(id, win)).rejects.toThrow(
    'Unsupported API',
  );
  await expect(
    access(path.join(mocks.root, 'Extensions', id, '1.0_0')),
  ).rejects.toThrow();
  expect(await readdir(path.join(mocks.root, 'Import Staging'))).toEqual([]);
});
it('preserves an existing package if committing the downloaded version fails', async () => {
  const target = path.join(mocks.root, 'Extensions', id, '1.0_0');
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'keep.txt'), 'existing');
  await expect(importer().importFromStore(id, win)).rejects.toThrow();
  expect(await readFile(path.join(target, 'keep.txt'), 'utf8')).toBe(
    'existing',
  );
  expect(session.extensions.loadExtension).not.toHaveBeenCalled();
});
