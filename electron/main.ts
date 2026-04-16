import { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Menu, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'

let mainWindow: BrowserWindow | null = null
let clipboardWatchInterval: ReturnType<typeof setInterval> | null = null
let lastClipboardText = ''
let clipboardWatchEnabled = false

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const WORKSPACE_SCHEMA_VERSION = '1.0.0'
const APP_STATE_VERSION = '3.0.0'
const DEFAULT_WORKSPACE_NAME = 'Default'
const WORKSPACE_ROOT_DIRNAME = 'AI-CS-Workspaces'

let isCompactMode = false
let savedBounds: Electron.Rectangle | null = null

type JsonEnvelope<T> = {
  version: string
  updatedAt: string
  data: T
}

type WorkspaceMetadata = {
  name: string
  description: string
  defaultLanguage: string
  createdAt: string
  lastOpenedAt: string
}

type WorkspaceInfo = {
  name: string
  path: string
  description: string
  defaultLanguage: string
  createdAt: string
  lastOpenedAt: string
}

type AppState = {
  version: string
  updatedAt: string
  currentWorkspacePath?: string
  recentWorkspacePaths: string[]
}

type SessionRecord = {
  timestamp: string
  intent: string
  language: string
  decision: 'AUTO' | 'HUMAN'
  matched: boolean
  edited: boolean
  savedAsScript: boolean
}

type BackupReason = 'manual' | 'settings' | 'knowledge-base' | 'memory'

type BackupManifest = {
  id: string
  createdAt: string
  reason: BackupReason
}

type BackupInfo = BackupManifest & {
  path: string
}

type WorkspaceChangeStatus = {
  hasExternalChanges: boolean
  changedFiles: string[]
  checkedAt: string
}

type WorkspaceListItem = {
  path: string
  name: string
}

const MAX_BACKUPS = 20
const AUTO_BACKUP_COOLDOWN_MS = 60 * 1000
const workspaceFingerprints = new Map<string, Map<string, string>>()
const lastAutoBackupAt = new Map<string, number>()

function nowIso() {
  return new Date().toISOString()
}

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
      nodeIntegration: false,
    },
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

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function writeTextAtomic(filePath: string, content: string) {
  ensureDir(path.dirname(filePath))
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, content, 'utf-8')
  fs.renameSync(tempPath, filePath)
}

function writeJsonAtomic<T>(filePath: string, value: T) {
  writeTextAtomic(filePath, JSON.stringify(value, null, 2))
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function listFilesRecursive(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const output: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      output.push(...listFilesRecursive(fullPath))
    } else {
      output.push(fullPath)
    }
  }

  return output
}

function copyDirContents(sourceDir: string, targetDir: string) {
  if (!fs.existsSync(sourceDir)) return

  for (const sourceFile of listFilesRecursive(sourceDir)) {
    const relativePath = path.relative(sourceDir, sourceFile)
    const targetFile = path.join(targetDir, relativePath)
    ensureDir(path.dirname(targetFile))
    fs.copyFileSync(sourceFile, targetFile)
  }
}

function removeDirRecursive(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

function execPowerShell(command: string) {
  return new Promise<void>((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      }
    )
  })
}

function getAppStatePath() {
  return path.join(app.getPath('userData'), 'app-state.json')
}

function getDefaultWorkspaceRoot() {
  const documentsPath = app.getPath('documents')
  const fallback = path.join(app.getPath('userData'), 'workspaces')
  return documentsPath ? path.join(documentsPath, WORKSPACE_ROOT_DIRNAME) : fallback
}

function sanitizeWorkspaceName(name: string) {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').slice(0, 80) || DEFAULT_WORKSPACE_NAME
}

function getWorkspacePaths(workspacePath: string) {
  return {
    root: workspacePath,
    workspace: path.join(workspacePath, 'workspace.json'),
    prompts: path.join(workspacePath, 'prompts.json'),
    providers: path.join(workspacePath, 'providers.json'),
    uiSettings: path.join(workspacePath, 'ui-settings.json'),
    knowledgeBase: path.join(workspacePath, 'knowledge-base.json'),
    statsDir: path.join(workspacePath, 'stats'),
    statsSessions: path.join(workspacePath, 'stats', 'sessions.jsonl'),
    memoryDir: path.join(workspacePath, 'memory'),
    memoryDailyDir: path.join(workspacePath, 'memory', 'daily'),
    backupsDir: path.join(workspacePath, 'backups'),
    exportsDir: path.join(workspacePath, 'exports'),
  }
}

function getBackupSnapshotDir(workspacePath: string, backupId: string) {
  return path.join(getWorkspacePaths(workspacePath).backupsDir, backupId)
}

function getTrackedWorkspaceFiles(workspacePath: string) {
  const paths = getWorkspacePaths(workspacePath)
  return [
    { type: 'file' as const, source: paths.workspace, relative: 'workspace.json' },
    { type: 'file' as const, source: paths.prompts, relative: 'prompts.json' },
    { type: 'file' as const, source: paths.providers, relative: 'providers.json' },
    { type: 'file' as const, source: paths.uiSettings, relative: 'ui-settings.json' },
    { type: 'file' as const, source: paths.knowledgeBase, relative: 'knowledge-base.json' },
    { type: 'dir' as const, source: paths.statsDir, relative: 'stats' },
    { type: 'dir' as const, source: paths.memoryDir, relative: 'memory' },
  ]
}

function createDefaultWorkspaceMetadata(name = DEFAULT_WORKSPACE_NAME): JsonEnvelope<WorkspaceMetadata> {
  const now = nowIso()
  return {
    version: WORKSPACE_SCHEMA_VERSION,
    updatedAt: now,
    data: {
      name,
      description: '',
      defaultLanguage: 'auto',
      createdAt: now,
      lastOpenedAt: now,
    },
  }
}

function ensureWorkspaceScaffold(workspacePath: string, name = DEFAULT_WORKSPACE_NAME) {
  const paths = getWorkspacePaths(workspacePath)
  ensureDir(paths.root)
  ensureDir(paths.statsDir)
  ensureDir(paths.memoryDailyDir)
  ensureDir(paths.backupsDir)
  ensureDir(paths.exportsDir)

  const memoryFiles = ['CONSTITUTION.md', 'SOUL.md', 'SKILLS.md', 'SCRIPTS_FEEDBACK.md', 'HEARTBEAT.md']
  for (const fileName of memoryFiles) {
    const filePath = path.join(paths.memoryDir, fileName)
    if (!fs.existsSync(filePath)) {
      writeTextAtomic(filePath, '')
    }
  }

  if (!fs.existsSync(paths.workspace)) {
    writeJsonAtomic(paths.workspace, createDefaultWorkspaceMetadata(name))
  }
  if (!fs.existsSync(paths.prompts)) {
    writeJsonAtomic(paths.prompts, { version: WORKSPACE_SCHEMA_VERSION, updatedAt: nowIso(), data: {} })
  }
  if (!fs.existsSync(paths.providers)) {
    writeJsonAtomic(paths.providers, { version: WORKSPACE_SCHEMA_VERSION, updatedAt: nowIso(), data: {} })
  }
  if (!fs.existsSync(paths.uiSettings)) {
    writeJsonAtomic(paths.uiSettings, { version: WORKSPACE_SCHEMA_VERSION, updatedAt: nowIso(), data: {} })
  }
  if (!fs.existsSync(paths.knowledgeBase)) {
    writeJsonAtomic(paths.knowledgeBase, { version: WORKSPACE_SCHEMA_VERSION, entries: [], categories: [] })
  }
  if (!fs.existsSync(paths.statsSessions)) {
    writeTextAtomic(paths.statsSessions, '')
  }
}

function readAppState(): AppState | null {
  const state = readJsonFile<AppState>(getAppStatePath())
  if (!state) return null

  if (state.version === APP_STATE_VERSION) {
    return state
  }

  const recentWorkspacePaths = state.currentWorkspacePath
    ? upsertRecentWorkspace(state.recentWorkspacePaths ?? [], state.currentWorkspacePath)
    : (state.recentWorkspacePaths ?? [])

  const migrated: AppState = {
    version: APP_STATE_VERSION,
    updatedAt: nowIso(),
    recentWorkspacePaths,
  }
  writeAppState(migrated)
  return migrated
}

function writeAppState(state: AppState) {
  writeJsonAtomic(getAppStatePath(), state)
}

function upsertRecentWorkspace(paths: string[], workspacePath: string) {
  const normalized = path.normalize(workspacePath)
  return [normalized, ...paths.filter(item => path.normalize(item) !== normalized)].slice(0, 10)
}

function getLegacySettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function getLegacyKnowledgeBasePath() {
  return path.join(app.getPath('userData'), 'knowledge-base.json')
}

function getLegacyMemoryDir() {
  if (VITE_DEV_SERVER_URL) {
    return path.join(app.getAppPath(), 'memory')
  }
  return path.join(app.getPath('userData'), 'memory')
}

function migrateLegacyDataIfNeeded(workspacePath: string) {
  const paths = getWorkspacePaths(workspacePath)

  const legacySettingsPath = getLegacySettingsPath()
  if (fs.existsSync(legacySettingsPath)) {
    const legacySettings = readJsonFile<Record<string, unknown>>(legacySettingsPath)
    if (legacySettings) {
      const prompts = {
        version: WORKSPACE_SCHEMA_VERSION,
        updatedAt: nowIso(),
        data: {
          promptA: legacySettings.promptA,
          promptB: legacySettings.promptB,
        },
      }
      const providers = {
        version: WORKSPACE_SCHEMA_VERSION,
        updatedAt: nowIso(),
        data: {
          llmProvider: legacySettings.llmProvider,
          llmProviders: legacySettings.llmProviders,
          activeProviderId: legacySettings.activeProviderId,
          step1Model: legacySettings.step1Model,
          step2Model: legacySettings.step2Model,
        },
      }
      const uiSettings = {
        version: WORKSPACE_SCHEMA_VERSION,
        updatedAt: nowIso(),
        data: {
          alwaysOnTop: legacySettings.alwaysOnTop,
        },
      }

      const currentPrompts = readEnvelopeData<Record<string, unknown>>(paths.prompts, {})
      const currentProviders = readEnvelopeData<Record<string, unknown>>(paths.providers, {})
      const currentUiSettings = readEnvelopeData<Record<string, unknown>>(paths.uiSettings, {})

      if (!currentPrompts.promptA && !currentPrompts.promptB) {
        writeJsonAtomic(paths.prompts, prompts)
      }
      if (!currentProviders.llmProvider && !currentProviders.llmProviders) {
        writeJsonAtomic(paths.providers, providers)
      }
      if (Object.keys(currentUiSettings).length === 0) {
        writeJsonAtomic(paths.uiSettings, uiSettings)
      }

      const workspaceEnvelope = readJsonFile<JsonEnvelope<WorkspaceMetadata>>(paths.workspace)
      if (workspaceEnvelope) {
        workspaceEnvelope.updatedAt = nowIso()
        workspaceEnvelope.data.defaultLanguage = typeof legacySettings.defaultLanguage === 'string'
          ? legacySettings.defaultLanguage
          : workspaceEnvelope.data.defaultLanguage
        writeJsonAtomic(paths.workspace, workspaceEnvelope)
      }
    }
  }

  const legacyKnowledgePath = getLegacyKnowledgeBasePath()
  if (fs.existsSync(legacyKnowledgePath)) {
    const existingKnowledge = readJsonFile(paths.knowledgeBase)
    if (
      !existingKnowledge ||
      !Array.isArray((existingKnowledge as { entries?: unknown[] }).entries) ||
      ((existingKnowledge as { entries?: unknown[] }).entries?.length ?? 0) === 0
    ) {
      const legacyKnowledge = readJsonFile(legacyKnowledgePath)
      if (legacyKnowledge) {
        writeJsonAtomic(paths.knowledgeBase, legacyKnowledge)
      }
    }
  }

  if (listFilesRecursive(paths.memoryDir).length <= 5) {
    copyDirContents(getLegacyMemoryDir(), paths.memoryDir)
  }
}

function getStoredWorkspacePath() {
  const state = readAppState()
  if (!state?.currentWorkspacePath) return null
  const currentWorkspacePath = path.normalize(state.currentWorkspacePath)
  if (!fs.existsSync(currentWorkspacePath)) return null

  ensureWorkspaceScaffold(currentWorkspacePath, path.basename(currentWorkspacePath))
  workspaceFingerprints.set(currentWorkspacePath, captureWorkspaceFingerprint(currentWorkspacePath))
  return currentWorkspacePath
}

function getCurrentWorkspacePath() {
  return getStoredWorkspacePath()
}

function requireCurrentWorkspacePath() {
  const workspacePath = getCurrentWorkspacePath()
  if (!workspacePath) {
    throw new Error('No workspace selected')
  }
  return workspacePath
}

function captureWorkspaceFingerprint(workspacePath: string) {
  const fingerprint = new Map<string, string>()
  const tracked = getTrackedWorkspaceFiles(workspacePath)

  for (const item of tracked) {
    if (item.type === 'file') {
      if (!fs.existsSync(item.source)) {
        fingerprint.set(item.relative, 'missing')
        continue
      }
      const stat = fs.statSync(item.source)
      fingerprint.set(item.relative, `${stat.size}:${stat.mtimeMs}`)
      continue
    }

    if (!fs.existsSync(item.source)) {
      fingerprint.set(item.relative, 'missing')
      continue
    }

    const files = listFilesRecursive(item.source)
    if (files.length === 0) {
      fingerprint.set(item.relative, 'empty')
      continue
    }

    for (const filePath of files) {
      const stat = fs.statSync(filePath)
      const relative = path.join(item.relative, path.relative(item.source, filePath)).replace(/\\/g, '/')
      fingerprint.set(relative, `${stat.size}:${stat.mtimeMs}`)
    }
  }

  return fingerprint
}

function updateWorkspaceFingerprint(workspacePath: string) {
  workspaceFingerprints.set(workspacePath, captureWorkspaceFingerprint(workspacePath))
}

function checkWorkspaceExternalChanges(workspacePath: string): WorkspaceChangeStatus {
  const previous = workspaceFingerprints.get(workspacePath) ?? new Map<string, string>()
  const current = captureWorkspaceFingerprint(workspacePath)
  const keys = new Set([...previous.keys(), ...current.keys()])
  const changedFiles: string[] = []

  for (const key of keys) {
    if (previous.get(key) !== current.get(key)) {
      changedFiles.push(key)
    }
  }

  return {
    hasExternalChanges: changedFiles.length > 0,
    changedFiles: changedFiles.sort(),
    checkedAt: nowIso(),
  }
}

function acknowledgeWorkspaceState(workspacePath: string) {
  updateWorkspaceFingerprint(workspacePath)
}

function readWorkspaceEnvelope() {
  const workspacePath = requireCurrentWorkspacePath()
  const workspaceFile = getWorkspacePaths(workspacePath).workspace
  return readJsonFile<JsonEnvelope<WorkspaceMetadata>>(workspaceFile) ?? createDefaultWorkspaceMetadata(path.basename(workspacePath))
}

function writeWorkspaceEnvelope(envelope: JsonEnvelope<WorkspaceMetadata>) {
  const workspacePath = requireCurrentWorkspacePath()
  const workspaceFile = getWorkspacePaths(workspacePath).workspace
  envelope.version = WORKSPACE_SCHEMA_VERSION
  envelope.updatedAt = nowIso()
  envelope.data.lastOpenedAt = nowIso()
  writeJsonAtomic(workspaceFile, envelope)
}

function getCurrentWorkspaceInfo(): WorkspaceInfo {
  const workspacePath = requireCurrentWorkspacePath()
  const envelope = readWorkspaceEnvelope()
  return {
    path: workspacePath,
    name: envelope.data.name,
    description: envelope.data.description,
    defaultLanguage: envelope.data.defaultLanguage,
    createdAt: envelope.data.createdAt,
    lastOpenedAt: envelope.data.lastOpenedAt,
  }
}

function listRecentWorkspacesInternal(): WorkspaceListItem[] {
  const state = readAppState()
  return (state?.recentWorkspacePaths ?? [])
    .filter(item => fs.existsSync(item))
    .map(workspacePath => {
      const metadata = readJsonFile<JsonEnvelope<WorkspaceMetadata>>(getWorkspacePaths(workspacePath).workspace)
      return {
        path: workspacePath,
        name: metadata?.data.name ?? path.basename(workspacePath),
      }
    })
}

function readEnvelopeData<T>(filePath: string, fallback: T): T {
  const raw = readJsonFile<JsonEnvelope<T> | T>(filePath)
  if (!raw) return fallback
  if (typeof raw === 'object' && raw !== null && 'data' in raw) {
    return (raw as JsonEnvelope<T>).data
  }
  return raw as T
}

function writeEnvelopeData<T>(filePath: string, data: T) {
  writeJsonAtomic(filePath, {
    version: WORKSPACE_SCHEMA_VERSION,
    updatedAt: nowIso(),
    data,
  })
}

function readSettingsFromWorkspace() {
  const workspacePath = requireCurrentWorkspacePath()
  const paths = getWorkspacePaths(workspacePath)
  const prompts = readEnvelopeData<Record<string, unknown>>(paths.prompts, {})
  const providers = readEnvelopeData<Record<string, unknown>>(paths.providers, {})
  const uiSettings = readEnvelopeData<Record<string, unknown>>(paths.uiSettings, {})
  const workspace = readWorkspaceEnvelope()

  return {
    ...providers,
    ...prompts,
    ...uiSettings,
    defaultLanguage: workspace.data.defaultLanguage,
  }
}

function writeSettingsToWorkspace(settings: Record<string, unknown>) {
  const workspacePath = requireCurrentWorkspacePath()
  const paths = getWorkspacePaths(workspacePath)

  writeEnvelopeData(paths.prompts, {
    promptA: settings.promptA,
    promptB: settings.promptB,
  })

  writeEnvelopeData(paths.providers, {
    llmProvider: settings.llmProvider,
    llmProviders: settings.llmProviders,
    activeProviderId: settings.activeProviderId,
    step1Model: settings.step1Model,
    step2Model: settings.step2Model,
  })

  writeEnvelopeData(paths.uiSettings, {
    alwaysOnTop: settings.alwaysOnTop,
    opacity: settings.opacity,
    compactMode: settings.compactMode,
  })

  const workspaceEnvelope = readWorkspaceEnvelope()
  workspaceEnvelope.data.defaultLanguage = typeof settings.defaultLanguage === 'string'
    ? settings.defaultLanguage
    : workspaceEnvelope.data.defaultLanguage
  writeWorkspaceEnvelope(workspaceEnvelope)
}

function createWorkspaceBackup(reason: BackupReason): BackupInfo {
  const workspacePath = requireCurrentWorkspacePath()
  const backupId = nowIso().replace(/[:.]/g, '-')
  const backupDir = getBackupSnapshotDir(workspacePath, backupId)
  ensureDir(backupDir)

  for (const item of getTrackedWorkspaceFiles(workspacePath)) {
    const target = path.join(backupDir, item.relative)
    if (!fs.existsSync(item.source)) continue

    if (item.type === 'file') {
      ensureDir(path.dirname(target))
      fs.copyFileSync(item.source, target)
    } else {
      copyDirContents(item.source, target)
    }
  }

  const manifest: BackupManifest = {
    id: backupId,
    createdAt: nowIso(),
    reason,
  }
  writeJsonAtomic(path.join(backupDir, 'backup.json'), manifest)
  pruneWorkspaceBackups(workspacePath)

  return {
    ...manifest,
    path: backupDir,
  }
}

function listWorkspaceBackups(workspacePath: string): BackupInfo[] {
  const backupsDir = getWorkspacePaths(workspacePath).backupsDir
  if (!fs.existsSync(backupsDir)) return []

  return fs.readdirSync(backupsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const backupDir = path.join(backupsDir, entry.name)
      const manifest = readJsonFile<BackupManifest>(path.join(backupDir, 'backup.json'))
      if (!manifest) return null
      return {
        ...manifest,
        path: backupDir,
      }
    })
    .filter((item): item is BackupInfo => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function pruneWorkspaceBackups(workspacePath: string) {
  const backups = listWorkspaceBackups(workspacePath)
  for (const backup of backups.slice(MAX_BACKUPS)) {
    removeDirRecursive(backup.path)
  }
}

function restoreWorkspaceBackup(backupId: string) {
  const workspacePath = requireCurrentWorkspacePath()
  const backupDir = getBackupSnapshotDir(workspacePath, backupId)
  if (!fs.existsSync(backupDir)) {
    throw new Error('Backup not found')
  }

  for (const item of getTrackedWorkspaceFiles(workspacePath)) {
    if (item.type === 'file') {
      if (fs.existsSync(item.source)) {
        fs.unlinkSync(item.source)
      }
      const backupFile = path.join(backupDir, item.relative)
      if (fs.existsSync(backupFile)) {
        ensureDir(path.dirname(item.source))
        fs.copyFileSync(backupFile, item.source)
      }
      continue
    }

    removeDirRecursive(item.source)
    const backupSource = path.join(backupDir, item.relative)
    if (fs.existsSync(backupSource)) {
      copyDirContents(backupSource, item.source)
    } else {
      ensureDir(item.source)
    }
  }

  acknowledgeWorkspaceState(workspacePath)
}

function backupBeforeMutation(reason: BackupReason) {
  const workspacePath = requireCurrentWorkspacePath()
  const tracked = getTrackedWorkspaceFiles(workspacePath)
  const hasData = tracked.some(item => fs.existsSync(item.source))
  if (!hasData) return null
  if (reason !== 'manual') {
    const backupKey = `${workspacePath}:${reason}`
    const lastCreatedAt = lastAutoBackupAt.get(backupKey) ?? 0
    const now = Date.now()
    if (now - lastCreatedAt < AUTO_BACKUP_COOLDOWN_MS) {
      return null
    }
    lastAutoBackupAt.set(backupKey, now)
  }
  return createWorkspaceBackup(reason)
}

function updateCurrentWorkspacePath(workspacePath: string) {
  const normalizedPath = path.normalize(workspacePath)
  ensureWorkspaceScaffold(normalizedPath, path.basename(normalizedPath))
  const state = readAppState()
  writeAppState({
    version: APP_STATE_VERSION,
    updatedAt: nowIso(),
    currentWorkspacePath: normalizedPath,
    recentWorkspacePaths: upsertRecentWorkspace(state?.recentWorkspacePaths ?? [], normalizedPath),
  })
  acknowledgeWorkspaceState(normalizedPath)
  return getCurrentWorkspaceInfo()
}

async function exportWorkspaceZip() {
  const workspace = getCurrentWorkspaceInfo()
  const defaultPath = path.join(getWorkspacePaths(workspace.path).exportsDir, `${sanitizeWorkspaceName(workspace.name)}.zip`)
  const dialogResult = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: '导出工作区',
    defaultPath,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  })

  if (dialogResult.canceled || !dialogResult.filePath) {
    return null
  }

  const targetZip = dialogResult.filePath.endsWith('.zip') ? dialogResult.filePath : `${dialogResult.filePath}.zip`
  ensureDir(path.dirname(targetZip))
  if (fs.existsSync(targetZip)) {
    fs.unlinkSync(targetZip)
  }

  const escapedSource = workspace.path.replace(/'/g, "''")
  const escapedTarget = targetZip.replace(/'/g, "''")
  await execPowerShell(`Compress-Archive -Path '${escapedSource}\\*' -DestinationPath '${escapedTarget}' -Force`)
  return targetZip
}

async function importWorkspaceZip() {
  const openResult = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: '导入工作区 ZIP',
    properties: ['openFile'],
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  })

  if (openResult.canceled || openResult.filePaths.length === 0) {
    return null
  }

  const zipPath = openResult.filePaths[0]
  const workspaceRoot = getDefaultWorkspaceRoot()
  ensureDir(workspaceRoot)
  const baseName = sanitizeWorkspaceName(path.basename(zipPath, path.extname(zipPath)))
  let workspacePath = path.join(workspaceRoot, baseName)
  let counter = 1
  while (fs.existsSync(workspacePath)) {
    workspacePath = path.join(workspaceRoot, `${baseName}-${counter}`)
    counter += 1
  }

  ensureDir(workspacePath)
  const escapedZip = zipPath.replace(/'/g, "''")
  const escapedDest = workspacePath.replace(/'/g, "''")
  await execPowerShell(`Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`)
  ensureWorkspaceScaffold(workspacePath, path.basename(workspacePath))
  updateCurrentWorkspacePath(workspacePath)
  return getCurrentWorkspaceInfo()
}

async function openWorkspaceDirectory() {
  const openResult = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: '打开工作区目录',
    properties: ['openDirectory'],
    defaultPath: getDefaultWorkspaceRoot(),
  })

  if (openResult.canceled || openResult.filePaths.length === 0) {
    return null
  }

  return updateCurrentWorkspacePath(openResult.filePaths[0])
}

async function chooseWorkspaceBasePath() {
  const openResult = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: '选择工作区保存位置',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: getDefaultWorkspaceRoot(),
  })

  if (openResult.canceled || openResult.filePaths.length === 0) {
    return null
  }

  return path.normalize(openResult.filePaths[0])
}

function renameCurrentWorkspace(newName: string) {
  const current = getCurrentWorkspaceInfo()
  const trimmedName = sanitizeWorkspaceName(newName)
  if (!trimmedName) {
    throw new Error('Invalid workspace name')
  }

  const currentDir = path.dirname(current.path)
  const targetPath = path.join(currentDir, trimmedName)
  if (path.normalize(targetPath) !== path.normalize(current.path) && fs.existsSync(targetPath)) {
    throw new Error('Workspace already exists')
  }

  if (path.normalize(targetPath) !== path.normalize(current.path)) {
    fs.renameSync(current.path, targetPath)
  }

  const workspaceFile = getWorkspacePaths(targetPath).workspace
  const envelope = readJsonFile<JsonEnvelope<WorkspaceMetadata>>(workspaceFile) ?? createDefaultWorkspaceMetadata(trimmedName)
  envelope.data.name = trimmedName
  envelope.data.lastOpenedAt = nowIso()
  envelope.updatedAt = nowIso()
  writeJsonAtomic(workspaceFile, envelope)

  return updateCurrentWorkspacePath(targetPath)
}

function normalizeRelativeWorkspacePath(relativePath: string) {
  const memoryDir = getWorkspacePaths(requireCurrentWorkspacePath()).memoryDir
  const resolved = path.resolve(memoryDir, relativePath)
  const normalizedMemoryDir = path.normalize(memoryDir + path.sep)
  const normalizedResolved = path.normalize(resolved)

  if (!normalizedResolved.startsWith(normalizedMemoryDir)) {
    throw new Error('Invalid memory path')
  }

  return resolved
}

function readStatsRecordsFromWorkspace(): SessionRecord[] {
  const statsPath = getWorkspacePaths(requireCurrentWorkspacePath()).statsSessions
  if (!fs.existsSync(statsPath)) return []

  const lines = fs.readFileSync(statsPath, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const records: SessionRecord[] = []
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as SessionRecord)
    } catch {
      continue
    }
  }
  return records
}

function writeStatsRecordsToWorkspace(records: SessionRecord[]) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString()
  const filtered = records.filter(record => record.timestamp >= cutoffStr)
  const content = filtered.map(record => JSON.stringify(record)).join('\n')
  writeTextAtomic(getWorkspacePaths(requireCurrentWorkspacePath()).statsSessions, content ? `${content}\n` : '')
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('toggle-always-on-top', () => {
  if (!mainWindow) return false
  const isOnTop = mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(!isOnTop)
  return !isOnTop
})

ipcMain.handle('get-always-on-top', () => {
  return mainWindow?.isAlwaysOnTop() ?? false
})

ipcMain.handle('get-current-workspace', async () => {
  try {
    return getCurrentWorkspaceInfo()
  } catch {
    return null
  }
})

ipcMain.handle('list-recent-workspaces', async () => {
  return listRecentWorkspacesInternal()
})

ipcMain.handle('create-workspace', async (_event, options?: { name?: string; basePath?: string; chooseLocation?: boolean }) => {
  const selectedBasePath = options?.basePath
    ? path.normalize(options.basePath)
    : options?.chooseLocation
      ? await chooseWorkspaceBasePath()
      : getDefaultWorkspaceRoot()

  if (!selectedBasePath) {
    return null
  }

  ensureDir(selectedBasePath)
  const workspaceName = sanitizeWorkspaceName(options?.name ?? DEFAULT_WORKSPACE_NAME)
  const workspacePath = path.join(selectedBasePath, workspaceName)

  ensureWorkspaceScaffold(workspacePath, workspaceName)
  return updateCurrentWorkspacePath(workspacePath)
})

ipcMain.handle('switch-workspace', async (_event, workspacePath: string) => {
  return updateCurrentWorkspacePath(workspacePath)
})

ipcMain.handle('read-knowledge-base', async () => {
  return readJsonFile(getWorkspacePaths(requireCurrentWorkspacePath()).knowledgeBase)
})

ipcMain.handle('write-knowledge-base', async (_event, data: string) => {
  try {
    backupBeforeMutation('knowledge-base')
    writeTextAtomic(getWorkspacePaths(requireCurrentWorkspacePath()).knowledgeBase, data)
    updateWorkspaceFingerprint(requireCurrentWorkspacePath())
    return true
  } catch {
    return false
  }
})

ipcMain.handle('read-settings', async () => {
  try {
    return readSettingsFromWorkspace()
  } catch {
    return null
  }
})

ipcMain.handle('write-settings', async (_event, data: string) => {
  try {
    backupBeforeMutation('settings')
    writeSettingsToWorkspace(JSON.parse(data) as Record<string, unknown>)
    updateWorkspaceFingerprint(requireCurrentWorkspacePath())
    return true
  } catch {
    return false
  }
})

ipcMain.handle('copy-to-clipboard', async (_event, text: string) => {
  clipboard.writeText(text)
  return true
})

ipcMain.handle('get-app-path', () => {
  return app.getAppPath()
})

ipcMain.handle('set-opacity', (_event, opacity: number) => {
  if (!mainWindow) return
  mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, opacity)))
})

ipcMain.handle('get-opacity', () => {
  return mainWindow?.getOpacity() ?? 1.0
})

ipcMain.handle('toggle-compact-mode', () => {
  if (!mainWindow) return false
  if (isCompactMode) {
    if (savedBounds) {
      mainWindow.setBounds(savedBounds)
    } else {
      mainWindow.setSize(1280, 800)
    }
    mainWindow.setMinimumSize(480, 320)
    isCompactMode = false
  } else {
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
  }, 800)
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

ipcMain.handle('register-global-shortcut', (_event, accelerator: string) => {
  try {
    globalShortcut.unregisterAll()
    globalShortcut.register(accelerator, () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
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
      const text = await resp.text()
      return { ok: true, status: resp.status, body: text, stream: true }
    }

    const json = await resp.json()
    return { ok: true, status: resp.status, body: json }
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || String(err) }
  }
})

ipcMain.handle('read-memory-file', async (_event, relativePath: string) => {
  try {
    const filePath = normalizeRelativeWorkspacePath(relativePath)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
    return null
  } catch {
    return null
  }
})

ipcMain.handle('write-memory-file', async (_event, relativePath: string, content: string) => {
  if (relativePath === 'CONSTITUTION.md') {
    return false
  }
  try {
    backupBeforeMutation('memory')
    const filePath = normalizeRelativeWorkspacePath(relativePath)
    writeTextAtomic(filePath, content)
    updateWorkspaceFingerprint(requireCurrentWorkspacePath())
    return true
  } catch {
    return false
  }
})

ipcMain.handle('list-memory-daily', async () => {
  try {
    const dailyDir = getWorkspacePaths(requireCurrentWorkspacePath()).memoryDailyDir
    if (!fs.existsSync(dailyDir)) return []
    return fs.readdirSync(dailyDir)
      .filter(fileName => fileName.endsWith('.md'))
      .sort()
      .reverse()
  } catch {
    return []
  }
})

ipcMain.handle('read-stats-records', async () => {
  try {
    return readStatsRecordsFromWorkspace()
  } catch {
    return []
  }
})

ipcMain.handle('append-stats-record', async (_event, record: SessionRecord) => {
  try {
    const records = readStatsRecordsFromWorkspace()
    records.push(record)
    writeStatsRecordsToWorkspace(records)
    updateWorkspaceFingerprint(requireCurrentWorkspacePath())
    return true
  } catch {
    return false
  }
})

ipcMain.handle('list-workspace-backups', async () => {
  try {
    return listWorkspaceBackups(requireCurrentWorkspacePath())
  } catch {
    return []
  }
})

ipcMain.handle('create-workspace-backup', async (_event, reason: BackupReason = 'manual') => {
  try {
    return createWorkspaceBackup(reason)
  } catch {
    return null
  }
})

ipcMain.handle('restore-workspace-backup', async (_event, backupId: string) => {
  try {
    restoreWorkspaceBackup(backupId)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('check-workspace-external-changes', async () => {
  try {
    return checkWorkspaceExternalChanges(requireCurrentWorkspacePath())
  } catch {
    return {
      hasExternalChanges: false,
      changedFiles: [],
      checkedAt: nowIso(),
    }
  }
})

ipcMain.handle('acknowledge-workspace-state', async () => {
  try {
    acknowledgeWorkspaceState(requireCurrentWorkspacePath())
    return true
  } catch {
    return false
  }
})

ipcMain.handle('open-workspace-directory', async () => {
  try {
    return await openWorkspaceDirectory()
  } catch {
    return null
  }
})

ipcMain.handle('rename-current-workspace', async (_event, newName: string) => {
  try {
    return renameCurrentWorkspace(newName)
  } catch {
    return null
  }
})

ipcMain.handle('export-workspace-zip', async () => {
  try {
    return await exportWorkspaceZip()
  } catch {
    return null
  }
})

ipcMain.handle('import-workspace-zip', async () => {
  try {
    return await importWorkspaceZip()
  } catch {
    return null
  }
})

ipcMain.handle('update-last-stats-record', async (_event, patch: Partial<SessionRecord>) => {
  try {
    const records = readStatsRecordsFromWorkspace()
    if (records.length === 0) return false
    records[records.length - 1] = {
      ...records[records.length - 1],
      ...patch,
    }
    writeStatsRecordsToWorkspace(records)
    updateWorkspaceFingerprint(requireCurrentWorkspacePath())
    return true
  } catch {
    return false
  }
})
