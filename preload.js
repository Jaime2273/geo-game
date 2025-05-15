const { contextBridge, ipcRenderer } = require('electron');
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectJsonFile: () => ipcRenderer.invoke('select-json-file')
});
