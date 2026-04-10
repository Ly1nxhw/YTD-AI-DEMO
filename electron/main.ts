import { app, BrowserWindow, ipcMain, shell, clipboard, globalShortcut } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
let clipboardWatchInterval: ReturnType<typeof setInterval> | null = null
let lastClipboardText = ''
let clipboardWatchEnabled = false

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
    // Try multiple locations: absolute, app root, extraResources
    const candidates = path.isAbsolute(filePath)
      ? [filePath]
      : [
          path.join(app.getAppPath(), filePath),
          path.join(process.resourcesPath, filePath),
        ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8')
      }
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

// ===== Clipboard Watch =====

function startClipboardWatch() {
  if (clipboardWatchInterval) return
  lastClipboardText = clipboard.readText() || ''
  clipboardWatchEnabled = true

  clipboardWatchInterval = setInterval(() => {
    if (!clipboardWatchEnabled || !mainWindow) return
    const current = clipboard.readText() || ''
    if (current && current !== lastClipboardText && current.trim().length > 5) {
      lastClipboardText = current
      mainWindow.webContents.send('clipboard-new-text', current)
    }
  }, 800)  // poll every 800ms
}

function stopClipboardWatch() {
  if (clipboardWatchInterval) {
    clearInterval(clipboardWatchInterval)
    clipboardWatchInterval = null
  }
  clipboardWatchEnabled = false
}

ipcMain.handle('clipboard-watch-start', () => {
  startClipboardWatch()
  return true
})

ipcMain.handle('clipboard-watch-stop', () => {
  stopClipboardWatch()
  return true
})

ipcMain.handle('clipboard-watch-status', () => {
  return clipboardWatchEnabled
})

// ===== Global Shortcut =====

ipcMain.handle('register-global-shortcut', (_event, accelerator: string) => {
  try {
    globalShortcut.unregisterAll()
    globalShortcut.register(accelerator, () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
      // Also send current clipboard content
      const text = clipboard.readText() || ''
      if (text.trim().length > 5) {
        mainWindow.webContents.send('clipboard-new-text', text)
      }
    })
    return true
  } catch {
    return false
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopClipboardWatch()
})

// ===== LLM Proxy (bypass CORS) =====

ipcMain.handle('llm-proxy', async (_event, options: {
  url: string
  headers: Record<string, string>
  body: string
  stream?: boolean
}) => {
  try {
    const resp = await fetch(options.url, {
      method: 'POST',
      headers: options.headers,
      body: options.body,
    })

    if (!resp.ok) {
      const errorText = await resp.text()
      return { ok: false, status: resp.status, error: errorText }
    }

    if (options.stream) {
      // For streaming, read body and return as text (SSE events)
      const text = await resp.text()
      return { ok: true, status: resp.status, body: text, stream: true }
    } else {
      const json = await resp.json()
      return { ok: true, status: resp.status, body: json }
    }
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || String(err) }
  }
})

// ===== Memory System =====

function getMemoryDir(): string {
  // In dev: project root / memory
  // In production: extraResources / memory (with writable copy in userData)
  if (VITE_DEV_SERVER_URL) {
    return path.join(app.getAppPath(), 'memory')
  }
  // Production: use userData for writable memory
  const userMemory = path.join(app.getPath('userData'), 'memory')
  if (!fs.existsSync(userMemory)) {
    // Copy initial memory files from resources on first run
    const srcMemory = path.join(process.resourcesPath, 'memory')
    if (fs.existsSync(srcMemory)) {
      fs.cpSync(srcMemory, userMemory, { recursive: true })
    } else {
      fs.mkdirSync(userMemory, { recursive: true })
    }
  }
  return userMemory
}

ipcMain.handle('read-memory-file', async (_event, relativePath: string) => {
  try {
    const filePath = path.join(getMemoryDir(), relativePath)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
    return null
  } catch {
    return null
  }
})

ipcMain.handle('write-memory-file', async (_event, relativePath: string, content: string) => {
  // Block writes to CONSTITUTION.md
  if (relativePath === 'CONSTITUTION.md') {
    console.warn('[Memory] Blocked write attempt to CONSTITUTION.md')
    return false
  }
  try {
    const filePath = path.join(getMemoryDir(), relativePath)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('list-memory-daily', async () => {
  try {
    const dailyDir = path.join(getMemoryDir(), 'daily')
    if (!fs.existsSync(dailyDir)) return []
    return fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
  } catch {
    return []
  }
})
