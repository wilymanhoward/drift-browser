import { contextBridge, ipcRenderer } from 'electron';
import type { BrowserState, DriftAPI } from '../shared/browser';

const api: DriftAPI = {
  getState: () => ipcRenderer.invoke('drift:state'),
  navigate: (url) => ipcRenderer.invoke('drift:navigate', url),
  action: (action) => ipcRenderer.invoke('drift:action', action),
  tab: (command) => ipcRenderer.invoke('drift:tab', command),
  sidebar: (update) => ipcRenderer.invoke('drift:sidebar', update),
  onFocusAddress: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('drift:focus-address', listener);
    return () => ipcRenderer.removeListener('drift:focus-address', listener);
  },
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) =>
      callback(state);
    ipcRenderer.on('drift:state', listener);
    return () => ipcRenderer.removeListener('drift:state', listener);
  },
};
contextBridge.exposeInMainWorld('drift', api);
