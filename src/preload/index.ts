import { contextBridge, ipcRenderer } from 'electron';
import type { BrowserState, DriftAPI } from '../shared/browser';

const api: DriftAPI = {
  getState: () => ipcRenderer.invoke('drift:state'),
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
