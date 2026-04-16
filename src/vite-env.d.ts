/// <reference types="vite/client" />

interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  getAlwaysOnTop: () => Promise<boolean>
  getCurrentWorkspace: () => Promise<import('@/types').WorkspaceInfo | null>
  listRecentWorkspaces: () => Promise<Array<{ path: string; name: string }>>
  createWorkspace: (options?: { name?: string; basePath?: string; chooseLocation?: boolean }) => Promise<import('@/types').WorkspaceInfo | null>
  switchWorkspace: (workspacePath: string) => Promise<import('@/types').WorkspaceInfo>
  openWorkspaceDirectory: () => Promise<import('@/types').WorkspaceInfo | null>
  renameCurrentWorkspace: (newName: string) => Promise<import('@/types').WorkspaceInfo | null>
  exportWorkspaceZip: () => Promise<string | null>
  importWorkspaceZip: () => Promise<import('@/types').WorkspaceInfo | null>
  listWorkspaceBackups: () => Promise<import('@/types').BackupInfo[]>
  createWorkspaceBackup: (reason?: 'manual' | 'settings' | 'knowledge-base' | 'memory') => Promise<import('@/types').BackupInfo | null>
  restoreWorkspaceBackup: (backupId: string) => Promise<boolean>
  checkWorkspaceExternalChanges: () => Promise<import('@/types').WorkspaceChangeStatus>
  acknowledgeWorkspaceState: () => Promise<boolean>
  readKnowledgeBase: () => Promise<any | null>
  writeKnowledgeBase: (data: string) => Promise<boolean>
  readSettings: () => Promise<any | null>
  writeSettings: (data: string) => Promise<boolean>
  copyToClipboard: (text: string) => Promise<boolean>
  getAppPath: () => Promise<string>
  setOpacity: (opacity: number) => Promise<void>
  getOpacity: () => Promise<number>
  toggleCompactMode: () => Promise<boolean>
  getCompactMode: () => Promise<boolean>
  // Clipboard watch
  clipboardWatchStart: () => Promise<boolean>
  clipboardWatchStop: () => Promise<boolean>
  clipboardWatchStatus: () => Promise<boolean>
  onClipboardText: (callback: (text: string) => void) => () => void
  // Global shortcut
  registerGlobalShortcut: (accelerator: string) => Promise<boolean>
  // LLM proxy
  llmProxy: (options: { url: string; headers: Record<string, string>; body: string; stream?: boolean }) =>
    Promise<{ ok: boolean; status: number; body?: any; error?: string; stream?: boolean }>
  // Memory system
  readMemoryFile: (relativePath: string) => Promise<string | null>
  writeMemoryFile: (relativePath: string, content: string) => Promise<boolean>
  listMemoryDaily: () => Promise<string[]>
  // Stats system
  readStatsRecords: () => Promise<any[]>
  appendStatsRecord: (record: unknown) => Promise<boolean>
  updateLastStatsRecord: (patch: unknown) => Promise<boolean>
  readLearningSessions: () => Promise<import('@/types').LearningSession[]>
  appendLearningSession: (session: import('@/types').LearningSession) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
