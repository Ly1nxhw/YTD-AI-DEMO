// ===== Knowledge Base Types =====

export interface KnowledgeEntry {
  id: string
  category: string
  title: string
  keywords: string[]
  content: string
  scenario: string
  deleted?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface KnowledgeBase {
  version: string
  entries: KnowledgeEntry[]
  categories: string[]
}

// ===== LLM Types =====

export interface LLMProvider {
  id: string
  name: string
  type: 'openai-compatible' | 'ollama' | 'custom'
  apiUrl: string
  apiKey: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface Step1Result {
  chinese_translation: string
  detected_language: string
  intent: string
  keywords: string[]
  matched_ids: string[]
}

export interface MatchedEntry {
  entry: KnowledgeEntry
  score: number
}

export interface Step2Result {
  reply: string
  chinese: string
  unmatched: boolean
}

export interface GenerationState {
  status: 'idle' | 'step1' | 'matching' | 'step2' | 'done' | 'error'
  step1Result: Step1Result | null
  matchedEntries: MatchedEntry[]
  step2Result: Step2Result | null
  streamingReply: string
  streamingChinese: string
  error: string | null
}

// ===== Settings Types =====

export interface AppSettings {
  llmProvider: LLMProvider
  step1Model: string
  step2Model: string
  defaultLanguage: string
  promptA: string
  promptB: string
  alwaysOnTop: boolean
}

// ===== Language Types =====

export interface LanguageOption {
  code: string
  name: string
  flag: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: '自动检测', flag: '🌐' },
  { code: 'de', name: '德语', flag: '🇩🇪' },
  { code: 'en', name: '英语', flag: '🇬🇧' },
  { code: 'fr', name: '法语', flag: '🇫🇷' },
  { code: 'es', name: '西班牙语', flag: '🇪🇸' },
  { code: 'it', name: '意大利语', flag: '🇮🇹' },
  { code: 'nl', name: '荷兰语', flag: '🇳🇱' },
  { code: 'pl', name: '波兰语', flag: '🇵🇱' },
  { code: 'pt', name: '葡萄牙语', flag: '🇵🇹' },
  { code: 'ja', name: '日语', flag: '🇯🇵' },
  { code: 'ko', name: '韩语', flag: '🇰🇷' },
]
