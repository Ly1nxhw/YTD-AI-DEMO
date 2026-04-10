import { create } from 'zustand'
import type { GenerationState, MatchedEntry, Step2Result } from '@/types'
import { useKnowledgeStore } from './knowledge-store'
import { useSettingsStore } from './settings-store'
import { SUPPORTED_LANGUAGES } from '@/types'
import { runPipeline } from '@/agent/pipeline'
import { recordGap } from '@/agent/gap-tracker'
import { recordSession, markLastSessionEdited } from '@/agent/stats-tracker'

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
  triageInfo: null,
  qualityCheck: null,
  pipelineDecision: null,
  suggestedStrategy: null,
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
    const { llmProvider, promptB, step1Model, step2Model } = settings

    if (!llmProvider.apiKey && !llmProvider.apiUrl.includes('localhost')) {
      set({ status: 'error', error: '请先在设置中配置 API Key' })
      return
    }

    set({
      ...initialState,
      status: 'triage',
      customerMessage: get().customerMessage,
      selectedLanguage: get().selectedLanguage,
    })

    try {
      const activeEntries = useKnowledgeStore.getState().getActiveEntries()

      // Determine target language name for Step 2
      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)
      const targetLanguageName = selectedLanguage === 'auto' ? 'auto' : (langInfo?.name || selectedLanguage)

      const pipelineResult = await runPipeline(
        llmProvider,
        customerMessage,
        activeEntries,
        targetLanguageName,
        {
          onTriageComplete: (triage) => {
            set({
              step1Result: {
                chinese_translation: triage.chinese_translation,
                detected_language: triage.detected_language,
                intent: triage.intent,
                keywords: triage.keywords,
                matched_ids: triage.matched_ids,
              },
              triageInfo: triage.triage,
              suggestedStrategy: triage.suggested_strategy || null,
              status: 'matching',
            })
          },
          onMatchComplete: (entries) => {
            set({ matchedEntries: entries, status: 'step2' })
          },
          onGenerationToken: (token) => {
            set(state => ({
              streamingReply: state.streamingReply + token,
            }))
          },
          onGenerationComplete: (result) => {
            // handled below
          },
          onQualityCheck: (qc) => {
            set({
              qualityCheck: {
                pass: qc.pass,
                checks: qc.checks,
                failReasons: qc.failReasons,
              },
            })
          },
          onDecision: (decision) => {
            set({ pipelineDecision: decision })
          },
        },
        {
          step1Model: step1Model || undefined,
          step2Model: step2Model || undefined,
          promptB,
        }
      )

      // Track unmatched scenarios for gap analysis
      const s1 = get().step1Result
      if (pipelineResult.step2Result?.unmatched) {
        recordGap(
          s1?.intent || 'unknown',
          s1?.detected_language || '??',
          get().customerMessage
        )
      }

      // Record session stats
      recordSession({
        intent: s1?.intent || 'unknown',
        language: s1?.detected_language || '??',
        decision: get().triageInfo?.decision === 'AUTO' ? 'AUTO' : 'HUMAN',
        matched: !pipelineResult.step2Result?.unmatched,
        edited: false,
        savedAsScript: false,
      })

      set({
        step2Result: pipelineResult.step2Result,
        editedReply: pipelineResult.step2Result?.reply || '',
        suggestedStrategy: pipelineResult.suggestedStrategy,
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
      // Track if user edited the reply
      if (editedReply && step2Result?.reply && editedReply !== step2Result.reply) {
        markLastSessionEdited()
      }
      set({ isDraft: false })
    }
  },
}))
