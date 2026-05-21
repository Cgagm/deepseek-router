import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { initDatabase, loadDatabase, serializeDatabase, closeDatabase } from './database/schema'
import { setupRouterIPC } from './ipc/router'
import { setupStorageIPC } from './ipc/storage'
import { setupLicenseIPC } from './ipc/license'
import { setupFileIPC, setupAppIPC } from './ipc/file'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

let mainWindow: BrowserWindow | null = null

function getDbPath(): string {
  return join(app.getPath('userData'), 'cc-chinastack.db')
}

function persistDatabase(): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const data = serializeDatabase()
    writeFileSync(getDbPath(), Buffer.from(data))
  } catch (e) {
    console.error('Failed to persist database:', e)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 550,
    backgroundColor: '#FFFBF5',
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Auto-save database periodically
  setInterval(persistDatabase, 30000)

  mainWindow.on('close', () => {
    persistDatabase()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Dev or production URL
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Theme IPC
  ipcMain.on('app:setTheme', (_event, theme: string) => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-theme', '${theme}')`,
      )
    }
  })
}

// Window controls IPC
function setupWindowControls(): void {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  mainWindow?.on('maximize', () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow?.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))
}

app.whenReady().then(async () => {
  // Initialize database (async for sql.js WASM loading)
  try {
    if (existsSync(getDbPath())) {
      const { default: initSqlJs } = await import('sql.js')
      const SQL = await initSqlJs()
      const data = readFileSync(getDbPath())
      loadDatabase(new Uint8Array(data))
    } else {
      await initDatabase()
    }
  } catch (e) {
    console.error('Database init failed, starting fresh:', e)
    await initDatabase()
  }

  // Setup IPC handlers (order matters: router needs storage for API keys)
  setupRouterIPC()
  setupStorageIPC()
  setupLicenseIPC()
  setupFileIPC()
  setupAppIPC()

  createWindow()
  setupWindowControls()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  persistDatabase()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  persistDatabase()
  closeDatabase()
})
