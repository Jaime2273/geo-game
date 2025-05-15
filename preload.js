const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Puedes dejar esto vacío o eliminar el archivo si no lo usas para otras cosas
});
