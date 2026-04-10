/// <reference types="vite/client" />

interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  getAlwaysOnTop: () => Promise<boolean>
  readKnowledgeBase: () => Promise<any | null>
  writeKnowledgeBase: (data: string) => Promise<boolean>
  readSettings: () => Promise<any | null>
  writeSettings: (data: string) => Promise<boolean>
  readMarkdownFile: (filePath: string) => Promise<string | null>
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
