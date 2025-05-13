const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectJsonFile: () => ipcRenderer.invoke('select-json-file')
});