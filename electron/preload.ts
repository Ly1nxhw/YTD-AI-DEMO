import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  getCurrentWorkspace: () => ipcRenderer.invoke('get-current-workspace'),
  listRecentWorkspaces: () => ipcRenderer.invoke('list-recent-workspaces'),
  createWorkspace: (options?: { name?: string; basePath?: string; chooseLocation?: boolean }) => ipcRenderer.invoke('create-workspace', options),
  switchWorkspace: (workspacePath: string) => ipcRenderer.invoke('switch-workspace', workspacePath),
  openWorkspaceDirectory: () => ipcRenderer.invoke('open-workspace-directory'),
  renameCurrentWorkspace: (newName: string) => ipcRenderer.invoke('rename-current-workspace', newName),
  exportWorkspaceZip: () => ipcRenderer.invoke('export-workspace-zip'),
  importWorkspaceZip: () => ipcRenderer.invoke('import-workspace-zip'),
  listWorkspaceBackups: () => ipcRenderer.invoke('list-workspace-backups'),
  createWorkspaceBackup: (reason?: 'manual' | 'settings' | 'knowledge-base' | 'memory') => ipcRenderer.invoke('create-workspace-backup', reason),
  restoreWorkspaceBackup: (backupId: string) => ipcRenderer.invoke('restore-workspace-backup', backupId),
  checkWorkspaceExternalChanges: () => ipcRenderer.invoke('check-workspace-external-changes'),
  acknowledgeWorkspaceState: () => ipcRenderer.invoke('acknowledge-workspace-state'),
  readKnowledgeBase: () => ipcRenderer.invoke('read-knowledge-base'),
  writeKnowledgeBase: (data: string) => ipcRenderer.invoke('write-knowledge-base', data),
  readSettings: () => ipcRenderer.invoke('read-settings'),
  writeSettings: (data: string) => ipcRenderer.invoke('write-settings', data),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  setOpacity: (opacity: number) => ipcRenderer.invoke('set-opacity', opacity),
  getOpacity: () => ipcRenderer.invoke('get-opacity'),
  toggleCompactMode: () => ipcRenderer.invoke('toggle-compact-mode'),
  getCompactMode: () => ipcRenderer.invoke('get-compact-mode'),
  // Clipboard watch
  clipboardWatchStart: () => ipcRenderer.invoke('clipboard-watch-start'),
  clipboardWatchStop: () => ipcRenderer.invoke('clipboard-watch-stop'),
  clipboardWatchStatus: () => ipcRenderer.invoke('clipboard-watch-status'),
  onClipboardText: (callback: (text: string) => void) => {
    ipcRenderer.on('clipboard-new-text', (_event, text) => callback(text))
    return () => { ipcRenderer.removeAllListeners('clipboard-new-text') }
  },
  // Global shortcut
  registerGlobalShortcut: (accelerator: string) => ipcRenderer.invoke('register-global-shortcut', accelerator),
  // LLM proxy (bypass CORS)
  llmProxy: (options: { url: string; headers: Record<string, string>; body: string; stream?: boolean }) =>
    ipcRenderer.invoke('llm-proxy', options),
  // Memory system
  readMemoryFile: (relativePath: string) => ipcRenderer.invoke('read-memory-file', relativePath),
  writeMemoryFile: (relativePath: string, content: string) => ipcRenderer.invoke('write-memory-file', relativePath, content),
  listMemoryDaily: () => ipcRenderer.invoke('list-memory-daily'),
  // Stats system
  readStatsRecords: () => ipcRenderer.invoke('read-stats-records'),
  appendStatsRecord: (record: unknown) => ipcRenderer.invoke('append-stats-record', record),
  updateLastStatsRecord: (patch: unknown) => ipcRenderer.invoke('update-last-stats-record', patch),
  readLearningSessions: () => ipcRenderer.invoke('read-learning-sessions'),
  appendLearningSession: (session: unknown) => ipcRenderer.invoke('append-learning-session', session),
})
