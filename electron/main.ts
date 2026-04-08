import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let isCompactMode = false
let savedBounds: Electron.Rectangle | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    title: 'AI 客服助手',
    transparent: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ===== IPC Handlers =====

// Window always-on-top toggle
ipcMain.handle('toggle-always-on-top', () => {
  if (!mainWindow) return false
  const isOnTop = mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(!isOnTop)
  return !isOnTop
})

ipcMain.handle('get-always-on-top', () => {
  return mainWindow?.isAlwaysOnTop() ?? false
})

// Knowledge base file operations
const getKnowledgeBasePath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'knowledge-base.json')
}

const getSettingsPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'settings.json')
}

ipcMain.handle('read-knowledge-base', async () => {
  const kbPath = getKnowledgeBasePath()
  try {
    if (fs.existsSync(kbPath)) {
      const data = fs.readFileSync(kbPath, 'utf-8')
      return JSON.parse(data)
    }
    return null
  } catch {
    return null
  }
})

ipcMain.handle('write-knowledge-base', async (_event, data: string) => {
  const kbPath = getKnowledgeBasePath()
  try {
    fs.writeFileSync(kbPath, data, 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('read-settings', async () => {
  const settingsPath = getSettingsPath()
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(data)
    }
    return null
  } catch {
    return null
  }
})

ipcMain.handle('write-settings', async (_event, data: string) => {
  const settingsPath = getSettingsPath()
  try {
    fs.writeFileSync(settingsPath, data, 'utf-8')
    return true
  } catch {
    return false
  }
})

// Read the original markdown file for initial import
ipcMain.handle('read-markdown-file', async (_event, filePath: string) => {
  try {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(app.getAppPath(), filePath)
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf-8')
    }
    return null
  } catch {
    return null
  }
})

// Copy to clipboard
ipcMain.handle('copy-to-clipboard', async (_event, text: string) => {
  const { clipboard } = require('electron')
  clipboard.writeText(text)
  return true
})

// Get app path
ipcMain.handle('get-app-path', () => {
  return app.getAppPath()
})

// Window opacity control
ipcMain.handle('set-opacity', (_event, opacity: number) => {
  if (!mainWindow) return
  mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, opacity)))
})

ipcMain.handle('get-opacity', () => {
  return mainWindow?.getOpacity() ?? 1.0
})

// Compact mode toggle
ipcMain.handle('toggle-compact-mode', () => {
  if (!mainWindow) return false
  if (isCompactMode) {
    // Restore to full size
    if (savedBounds) {
      mainWindow.setBounds(savedBounds)
    } else {
      mainWindow.setSize(1280, 800)
    }
    mainWindow.setMinimumSize(480, 320)
    isCompactMode = false
  } else {
    // Save current bounds and switch to compact
    savedBounds = mainWindow.getBounds()
    mainWindow.setMinimumSize(380, 300)
    mainWindow.setSize(420, 600)
    mainWindow.setAlwaysOnTop(true)
    isCompactMode = true
  }
  return isCompactMode
})

ipcMain.handle('get-compact-mode', () => {
  return isCompactMode
})
