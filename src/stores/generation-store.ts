import { create } from 'zustand'
import type { GenerationState, Step1Result, MatchedEntry, Step2Result } from '@/types'
import { runStep1, runStep2, buildScriptCatalog } from '@/lib/llm-adapter'
import { useKnowledgeStore } from './knowledge-store'
import { useSettingsStore } from './settings-store'
import { SUPPORTED_LANGUAGES } from '@/types'

interface GenerationStore extends GenerationState {
  customerMessage: string
  selectedLanguage: string
  editedReply: string
  isDraft: boolean

  setCustomerMessage: (msg: string) => void
  setSelectedLanguage: (lang: string) => void
  setEditedReply: (reply: string) => void

  generateReply: () => Promise<void>
  reset: () => void
  confirmCopy: () => Promise<void>
}

const initialState: GenerationState = {
  status: 'idle',
  step1Result: null,
  matchedEntries: [],
  step2Result: null,
  streamingReply: '',
  streamingChinese: '',
  error: null,
}

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  ...initialState,
  customerMessage: '',
  selectedLanguage: 'auto',
  editedReply: '',
  isDraft: true,

  setCustomerMessage: (msg) => set({ customerMessage: msg }),
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  setEditedReply: (reply) => set({ editedReply: reply }),

  generateReply: async () => {
    const { customerMessage, selectedLanguage } = get()
    if (!customerMessage.trim()) return

    const settings = useSettingsStore.getState().settings
    const { llmProvider, promptA, promptB, step1Model, step2Model } = settings

    if (!llmProvider.apiKey && !llmProvider.apiUrl.includes('localhost')) {
      set({ status: 'error', error: '请先在设置中配置 API Key' })
      return
    }

    set({
      ...initialState,
      status: 'step1',
      customerMessage: get().customerMessage,
      selectedLanguage: get().selectedLanguage,
    })

    try {
      // Build script catalog from knowledge base for LLM matching
      const activeEntries = useKnowledgeStore.getState().getActiveEntries()
      const scriptCatalog = buildScriptCatalog(activeEntries)

      // Step 1: Understanding + LLM-based script matching
      const step1Result: Step1Result = await runStep1(
        llmProvider,
        customerMessage,
        scriptCatalog,
        promptA,
        step1Model || undefined
      )

      set({ step1Result, status: 'matching' })

      // Resolve matched_ids to actual entries
      const matchedEntries: MatchedEntry[] = (step1Result.matched_ids || [])
        .map(id => {
          const entry = activeEntries.find(e => e.id === id)
          return entry ? { entry, score: 1.0 } : null
        })
        .filter((m): m is MatchedEntry => m !== null)

      set({ matchedEntries, status: 'step2' })

      // Determine target language
      let targetLang = selectedLanguage
      if (targetLang === 'auto') {
        targetLang = step1Result.detected_language
      }
      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)
      const targetLanguageName = langInfo ? langInfo.name : targetLang

      // Step 2: Generation (with streaming)
      const step2Result: Step2Result = await runStep2(
        llmProvider,
        customerMessage,
        step1Result.chinese_translation,
        step1Result.intent,
        matchedEntries,
        targetLanguageName,
        promptB,
        step2Model || undefined,
        {
          onToken: (token) => {
            set(state => ({
              streamingReply: state.streamingReply + token,
            }))
          },
          onComplete: () => {
            // Handled below
          },
          onError: (error) => {
            set({ status: 'error', error })
          },
        }
      )

      set({
        step2Result,
        editedReply: step2Result.reply,
        isDraft: true,
        status: 'done',
      })
    } catch (error: any) {
      set({
        status: 'error',
        error: error.message || '生成失败，请检查 LLM 配置',
      })
    }
  },

  reset: () => {
    set({
      ...initialState,
      customerMessage: '',
      editedReply: '',
      isDraft: true,
    })
  },

  confirmCopy: async () => {
    const { editedReply, step2Result } = get()
    const textToCopy = editedReply || step2Result?.reply || ''
    if (textToCopy) {
      await window.electronAPI.copyToClipboard(textToCopy)
      set({ isDraft: false })
    }
  },
}))
