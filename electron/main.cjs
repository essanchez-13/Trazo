const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')
const fs = require('node:fs')

const dataDir = () => path.join(app.getPath('userData'), 'data')

function fileFor(key) {
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Clave inválida')
  return path.join(dataDir(), key + '.json')
}

// Escribe a un archivo temporal y luego lo renombra, para no corromper
// un cuaderno si la app se cierra a mitad de un guardado.
function writeAtomic(file, data) {
  fs.mkdirSync(dataDir(), { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

ipcMain.handle('store:read', (_e, key) => {
  try { return fs.readFileSync(fileFor(key), 'utf8') } catch { return null }
})
ipcMain.handle('store:write', (_e, key, data) => writeAtomic(fileFor(key), data))
ipcMain.handle('store:remove', (_e, key) => {
  try { fs.unlinkSync(fileFor(key)) } catch {}
})
ipcMain.on('store:writeSync', (e, key, data) => {
  try { writeAtomic(fileFor(key), data); e.returnValue = true } catch { e.returnValue = false }
})

ipcMain.on('theme:titlebar', (e, opts) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  try { win?.setTitleBarOverlay({ color: opts.color, symbolColor: opts.symbolColor }) } catch {}
  win?.setBackgroundColor(opts.color)
})

// ---- Actualizaciones automáticas (desde las versiones publicadas en GitHub) ----

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.on('update:check', () => {
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {})
})
ipcMain.on('update:install', () => autoUpdater.quitAndInstall())

function setupUpdates(win) {
  if (!app.isPackaged) return
  const send = (data) => { if (!win.isDestroyed()) win.webContents.send('update', data) }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'downloading', version: info.version }))
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    const notes = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note).join('\n') : info.releaseNotes
    send({ state: 'ready', version: info.version, notes: notes ?? undefined })
  })
  autoUpdater.on('update-not-available', () => send({ state: 'latest' }))
  // Sin internet o sin versiones publicadas: la app sigue funcionando igual.
  autoUpdater.on('error', (err) => send({ state: 'error', message: String(err?.message ?? err) }))
  // Al abrir y luego cada 3 horas, por si la app se queda abierta mucho tiempo.
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  setTimeout(check, 4000)
  setInterval(check, 3 * 60 * 60 * 1000)
}

function createWindow() {
  const iconFile = app.isPackaged ? path.join(__dirname, '..', 'dist', 'icon.ico') : path.join(__dirname, '..', 'public', 'icon.ico')
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f4f2ee',
    icon: iconFile,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#e9e7e2', symbolColor: '#3a3d42', height: 42 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setVisualZoomLevelLimits(1, 1)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  setupUpdates(win)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
  app.setAppUserModelId('com.trazo.notes')
  Menu.setApplicationMenu(null)
  app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
}
