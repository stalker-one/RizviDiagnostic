const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBiometric', {
  isAvailable: () => ipcRenderer.invoke('biometric:is-available'),
  getStatus: () => ipcRenderer.invoke('biometric:get-status'),
  enable: (token) => ipcRenderer.invoke('biometric:enable', { token }),
  authenticate: () => ipcRenderer.invoke('biometric:authenticate'),
  disable: () => ipcRenderer.invoke('biometric:disable'),
});
