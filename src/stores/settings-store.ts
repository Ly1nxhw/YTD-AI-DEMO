import { create } from 'zustand'
import type { AppSettings, LLMProvider } from '@/types'
import { DEFAULT_PROMPT_A, DEFAULT_PROMPT_B } from '@/lib/llm-adapter'

const DEFAULT_PROVIDER: LLMProvider = {
  id: 'default',
  name: 'DeepSeek',
  type: 'openai-compatible',
  apiUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  maxTokens: 2000,
  temperature: 0.3,
}

const DEFAULT_SETTINGS: AppSettings = {
  llmProvider: DEFAULT_PROVIDER,
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
        // Auto-upgrade: if saved promptA is from the old TF-IDF era (no {script_catalog}), replace with new default
        let needsSave = false
        if (merged.promptA && !merged.promptA.includes('{script_catalog}')) {
          merged.promptA = DEFAULT_PROMPT_A
          needsSave = true
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
    const newSettings = { ...settings, llmProvider: newProvider }
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
