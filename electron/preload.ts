import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  readKnowledgeBase: () => ipcRenderer.invoke('read-knowledge-base'),
  writeKnowledgeBase: (data: string) => ipcRenderer.invoke('write-knowledge-base', data),
  readSettings: () => ipcRenderer.invoke('read-settings'),
  writeSettings: (data: string) => ipcRenderer.invoke('write-settings', data),
  readMarkdownFile: (filePath: string) => ipcRenderer.invoke('read-markdown-file', filePath),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  getAppPath: () => ipcRenderer.invoke('get-app-path')
})
