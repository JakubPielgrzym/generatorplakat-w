'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printApi', {
  job: () => ipcRenderer.invoke('printjob:get'),
  ready: (info) => ipcRenderer.invoke('printjob:ready', info)
});
