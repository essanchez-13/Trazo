const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('trazo', {
  isDesktop: true,
  read: (key) => ipcRenderer.invoke('store:read', key),
  write: (key, data) => ipcRenderer.invoke('store:write', key, data),
  remove: (key) => ipcRenderer.invoke('store:remove', key),
  writeSync: (key, data) => ipcRenderer.sendSync('store:writeSync', key, data),
  setTitleBar: (opts) => ipcRenderer.send('theme:titlebar', opts),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdates: () => ipcRenderer.send('update:check'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdate: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update', handler)
    return () => ipcRenderer.removeListener('update', handler)
  },
})
