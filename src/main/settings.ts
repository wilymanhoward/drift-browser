import type Store from 'electron-store';
import { nativeTheme, dialog, nativeImage } from 'electron';
import type { BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, parseSettings } from '../shared/settings';
import type { Settings } from '../shared/settings';
export class SettingsStore {
  value: Settings = structuredClone(DEFAULT_SETTINGS);
  error: string | null = null;
  private store: Store<{ settings: unknown }> | null = null;
  async load(privateWindow: boolean) {
    try {
      const { default: Store } = await import('electron-store');
      const store = new Store<{ settings: unknown }>({ name: 'settings' });
      const raw = store.get('settings');
      if (
        raw !== undefined &&
        (!raw || typeof raw !== 'object' || Array.isArray(raw))
      )
        throw new Error('Invalid saved settings');
      if (raw !== undefined && raw && typeof raw === 'object')
        this.value = parseSettings({
          expandedWidth: DEFAULT_SETTINGS.expandedWidth,
          ...raw,
          shortcuts: {
            ...DEFAULT_SETTINGS.shortcuts,
            ...(raw as { shortcuts?: object }).shortcuts,
          },
        });
      if (!privateWindow) this.store = store;
    } catch {
      this.error =
        'Settings could not be read. Defaults are active and the original file is preserved.';
    }
  }
  get dark() {
    return (
      this.value.theme === 'dark' ||
      (this.value.theme === 'system' && nativeTheme.shouldUseDarkColors)
    );
  }
  set(input: unknown) {
    const next = parseSettings(input);
    if (this.store) this.store.set('settings', next);
    this.value = next;
  }
  async transfer(win: BrowserWindow, mode: 'import' | 'export' | 'wallpaper') {
    if (mode === 'export') {
      const result = await dialog.showSaveDialog(win, {
        title: 'Export Drift settings',
        defaultPath: 'drift-settings.json',
        filters: [{ name: 'JSON settings', extensions: ['json'] }],
      });
      if (!result.canceled && result.filePath)
        await writeFile(result.filePath, JSON.stringify(this.value, null, 2));
      return;
    }
    const result = await dialog.showOpenDialog(win, {
      title:
        mode === 'import'
          ? 'Import Drift settings'
          : 'Choose a new-tab wallpaper',
      properties: ['openFile'],
      filters: [
        mode === 'import'
          ? { name: 'JSON settings', extensions: ['json'] }
          : {
              name: 'Wallpaper image',
              extensions: ['png', 'jpg', 'jpeg', 'webp'],
            },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return;
    const bytes = await readFile(result.filePaths[0]);
    if (bytes.length > 3 * 1024 * 1024)
      throw new Error('The file is too large.');
    if (mode === 'import') this.set(JSON.parse(bytes.toString('utf8')));
    else {
      if (nativeImage.createFromBuffer(bytes).isEmpty())
        throw new Error('The selected file is not a valid image.');
      const ext = result.filePaths[0].split('.').pop()!.toLowerCase();
      this.set({
        ...this.value,
        wallpaper: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${bytes.toString('base64')}`,
      });
    }
  }
}
