import { create } from 'zustand'
import type { WorkspaceInfo } from '@/types'

interface WorkspaceStore {
  workspace: WorkspaceInfo | null
  recent: Array<{ path: string; name: string }>
  loading: boolean
  loadWorkspace: () => Promise<void>
  createWorkspace: (options?: { name?: string; basePath?: string; chooseLocation?: boolean }) => Promise<boolean>
  switchWorkspace: (workspacePath: string) => Promise<void>
  openWorkspaceDirectory: () => Promise<boolean>
  renameWorkspace: (newName: string) => Promise<boolean>
  importWorkspaceZip: () => Promise<boolean>
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspace: null,
  recent: [],
  loading: false,

  loadWorkspace: async () => {
    set({ loading: true })
    try {
      const [workspace, recent] = await Promise.all([
        window.electronAPI.getCurrentWorkspace(),
        window.electronAPI.listRecentWorkspaces(),
      ])
      set({ workspace: workspace ?? null, recent })
    } finally {
      set({ loading: false })
    }
  },

  createWorkspace: async (options) => {
    set({ loading: true })
    try {
      const workspace = await window.electronAPI.createWorkspace(options)
      if (!workspace) return false
      const recent = await window.electronAPI.listRecentWorkspaces()
      set({ workspace, recent })
      return true
    } finally {
      set({ loading: false })
    }
  },

  switchWorkspace: async (workspacePath) => {
    set({ loading: true })
    try {
      const workspace = await window.electronAPI.switchWorkspace(workspacePath)
      const recent = await window.electronAPI.listRecentWorkspaces()
      set({ workspace, recent })
    } finally {
      set({ loading: false })
    }
  },

  openWorkspaceDirectory: async () => {
    set({ loading: true })
    try {
      const workspace = await window.electronAPI.openWorkspaceDirectory()
      if (!workspace) return false
      const recent = await window.electronAPI.listRecentWorkspaces()
      set({ workspace, recent })
      return true
    } finally {
      set({ loading: false })
    }
  },

  renameWorkspace: async (newName) => {
    set({ loading: true })
    try {
      const workspace = await window.electronAPI.renameCurrentWorkspace(newName)
      if (!workspace) return false
      const recent = await window.electronAPI.listRecentWorkspaces()
      set({ workspace, recent })
      return true
    } finally {
      set({ loading: false })
    }
  },

  importWorkspaceZip: async () => {
    set({ loading: true })
    try {
      const workspace = await window.electronAPI.importWorkspaceZip()
      if (!workspace) return false
      const recent = await window.electronAPI.listRecentWorkspaces()
      set({ workspace, recent })
      return true
    } finally {
      set({ loading: false })
    }
  },
}))
