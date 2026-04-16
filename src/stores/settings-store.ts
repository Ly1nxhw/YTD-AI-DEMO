import { create } from 'zustand'
import type { AppSettings, LLMProvider } from '@/types'
import { DEFAULT_PROMPT_A, DEFAULT_PROMPT_B } from '@/lib/llm-adapter'

const createBlankProvider = (): LLMProvider => ({
  id: 'custom-default',
  name: '自定义 Provider',
  type: 'openai-compatible',
  apiUrl: '',
  apiKey: '',
  model: '',
  maxTokens: 2000,
  temperature: 0.3,
})

const DEFAULT_SETTINGS: AppSettings = {
  llmProvider: createBlankProvider(),
  llmProviders: [createBlankProvider()],
  activeProviderId: 'custom-default',
  step1Model: '',
  step2Model: '',
  defaultLanguage: 'auto',
  promptA: DEFAULT_PROMPT_A,
  promptB: DEFAULT_PROMPT_B,
  alwaysOnTop: false,
}

interface SettingsStore {
  settings: AppSettings
  loading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  updateProvider: (updates: Partial<LLMProvider>) => Promise<void>
  switchProvider: (providerId: string) => Promise<void>
  addProvider: (provider: LLMProvider) => Promise<void>
  removeProvider: (providerId: string) => Promise<void>
  resetPrompts: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const data = await window.electronAPI.readSettings()
      if (data) {
        const merged = { ...DEFAULT_SETTINGS, ...data }
        let needsSave = false

        // Auto-upgrade: sync prompts
        if (merged.promptA !== DEFAULT_PROMPT_A) {
          merged.promptA = DEFAULT_PROMPT_A
          needsSave = true
        }
        if (merged.promptB !== DEFAULT_PROMPT_B) {
          merged.promptB = DEFAULT_PROMPT_B
          needsSave = true
        }

        // Migration: old format had no llmProviders array
        if (!merged.llmProviders || merged.llmProviders.length === 0) {
          const provider = merged.llmProvider ?? createBlankProvider()
          merged.llmProviders = [provider]
          merged.activeProviderId = provider.id || 'custom-default'
          needsSave = true
        }

        // Sync llmProvider to match activeProviderId
        const active = merged.llmProviders.find((p: LLMProvider) => p.id === merged.activeProviderId) ?? merged.llmProviders[0]
        if (active) {
          merged.llmProvider = active
          merged.activeProviderId = active.id
        }

        set({ settings: merged })
        if (needsSave) {
          await window.electronAPI.writeSettings(JSON.stringify(merged, null, 2))
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      set({ loading: false })
    }
  },

  updateSettings: async (updates) => {
    const { settings } = get()
    const newSettings = { ...settings, ...updates }
    await window.electronAPI.writeSettings(JSON.stringify(newSettings, null, 2))
    set({ settings: newSettings })
  },

  updateProvider: async (updates) => {
    const { settings } = get()
    const newProvider = { ...settings.llmProvider, ...updates }
    // Also update in the providers array
    const newProviders = settings.llmProviders.map(p =>
      p.id === newProvider.id ? newProvider : p
    )
    const newSettings = { ...settings, llmProvider: newProvider, llmProviders: newProviders }
    await window.electronAPI.writeSettings(JSON.stringify(newSettings, null, 2))
    set({ settings: newSettings })
  },

  switchProvider: async (providerId) => {
    const { settings } = get()
    const target = settings.llmProviders.find(p => p.id === providerId)
    if (!target) return
    const newSettings = { ...settings, llmProvider: target, activeProviderId: providerId }
    await window.electronAPI.writeSettings(JSON.stringify(newSettings, null, 2))
    set({ settings: newSettings })
  },

  addProvider: async (provider) => {
    const { settings } = get()
    const newProviders = [...settings.llmProviders, provider]
    const newSettings = { ...settings, llmProviders: newProviders }
    await window.electronAPI.writeSettings(JSON.stringify(newSettings, null, 2))
    set({ settings: newSettings })
  },

  removeProvider: async (providerId) => {
    const { settings } = get()
    if (settings.llmProviders.length <= 1) return  // keep at least 1
    const newProviders = settings.llmProviders.filter(p => p.id !== providerId)
    let newSettings = { ...settings, llmProviders: newProviders }
    // If removing the active provider, switch to first remaining
    if (settings.activeProviderId === providerId) {
      newSettings.llmProvider = newProviders[0]
      newSettings.activeProviderId = newProviders[0].id
    }
    await window.electronAPI.writeSettings(JSON.stringify(newSettings, null, 2))
    set({ settings: newSettings })
  },

  resetPrompts: async () => {
    const { settings } = get()
    const newSettings = {
      ...settings,
      promptA: DEFAULT_PROMPT_A,
      promptB: DEFAULT_PROMPT_B,
    }
    await window.electronAPI.writeSettings(JSON.stringify(newSettings, null, 2))
    set({ settings: newSettings })
  },
}))
