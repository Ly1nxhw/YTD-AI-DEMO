import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'AI 客服助手',
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
