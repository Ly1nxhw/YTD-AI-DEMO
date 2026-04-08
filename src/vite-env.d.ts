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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
