import { contextBridge, ipcRenderer } from 'electron';
import type { BrowserState, DriftAPI } from '../shared/browser';

const api: DriftAPI = {
  getState: () => ipcRenderer.invoke('drift:state'),
  find: (command) => ipcRenderer.invoke('drift:find', command),
  onFindFocus: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('drift:find-focus', listener);
    return () => ipcRenderer.removeListener('drift:find-focus', listener);
  },
  navigate: (url) => ipcRenderer.invoke('drift:navigate', url),
  action: (action) => ipcRenderer.invoke('drift:action', action),
  tab: (command) => ipcRenderer.invoke('drift:tab', command),
  sidebar: (update) => ipcRenderer.invoke('drift:sidebar', update),
  closeOverlay: () => ipcRenderer.invoke('drift:close-overlay'),
  getLibrary: () => ipcRenderer.invoke('drift:library'),
  bookmark: (command) => ipcRenderer.invoke('drift:bookmark', command),
  clearHistory: () => ipcRenderer.invoke('drift:clear-history'),
  getShields: () => ipcRenderer.invoke('drift:shields'),
  privacy: (command) => ipcRenderer.invoke('drift:privacy', command),
  settings: (value) => ipcRenderer.invoke('drift:settings', value),
  settingsFile: (mode) => ipcRenderer.invoke('drift:settings-file', mode),
  workspace: (command) => ipcRenderer.invoke('drift:workspace', command),
  splitRatio: (ratio) => ipcRenderer.invoke('drift:split-ratio', ratio),
  getDownloads: () => ipcRenderer.invoke('drift:downloads'),
  download: (command) => ipcRenderer.invoke('drift:download', command),
  onOverlay: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      overlay: Parameters<typeof callback>[0],
    ) => callback(overlay);
    ipcRenderer.on('drift:overlay', listener);
    return () => ipcRenderer.removeListener('drift:overlay', listener);
  },
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) =>
      callback(state);
    ipcRenderer.on('drift:state', listener);
    return () => ipcRenderer.removeListener('drift:state', listener);
  },
};
contextBridge.exposeInMainWorld('drift', api);
