/**
 * Agent Pipeline — 串联 Step0→1→2→3 的完整处理管线
 *
 * Step 0: 智能分流 (Triage) — AUTO / HUMAN
 * Step 1: 话术匹配 (已合并到 Step 0)
 * Step 2: 回复生成 (Generation)
 * Step 3: 质量校验 (Quality Check)
 */

import type { LLMProvider, KnowledgeEntry, MatchedEntry, Step2Result } from '@/types'
import type { TriageResult } from '@/lib/llm-adapter'
import { buildScriptCatalog, runTriageStep, runStep2 } from '@/lib/llm-adapter'
import { runQualityCheck } from './quality-check'
import type { QualityCheckResult } from './quality-check'
import { appendDailyLog } from './memory-manager'

export type PipelineDecision = 'AUTO' | 'HUMAN' | 'QUALITY_FAIL'

export interface PipelineResult {
  /** Final routing decision */
  decision: PipelineDecision
  /** Step 0 triage result */
  triage: TriageResult
  /** Matched knowledge base entries */
  matchedEntries: MatchedEntry[]
  /** Step 2 generated reply (may be null if HUMAN before generation) */
  step2Result: Step2Result | null
  /** Step 3 quality check (null if not run) */
  qualityCheck: QualityCheckResult | null
  /** Streaming reply text (updated during generation) */
  streamingReply: string
  /** Strategy suggestion for human agents */
  suggestedStrategy: string | null
}

export interface PipelineCallbacks {
  onTriageComplete?: (triage: TriageResult) => void
  onMatchComplete?: (entries: MatchedEntry[]) => void
  onGenerationToken?: (token: string) => void
  onGenerationComplete?: (result: Step2Result) => void
  onQualityCheck?: (result: QualityCheckResult) => void
  onDecision?: (decision: PipelineDecision) => void
}

/**
 * Run the full agent pipeline.
 */
export async function runPipeline(
  provider: LLMProvider,
  customerMessage: string,
  knowledgeEntries: KnowledgeEntry[],
  targetLanguage: string,
  callbacks?: PipelineCallbacks,
  opts?: {
    fallbackProvider?: LLMProvider | null
    step1Model?: string
    step2Model?: string
    promptB?: string
    forceHuman?: boolean  // force HUMAN regardless of triage
  }
): Promise<PipelineResult> {
  const result: PipelineResult = {
    decision: 'HUMAN',
    triage: {} as TriageResult,
    matchedEntries: [],
    step2Result: null,
    qualityCheck: null,
    streamingReply: '',
    suggestedStrategy: null,
  }

  // ===== Step 0: Triage + Match =====
  const catalog = buildScriptCatalog(knowledgeEntries)

  const triageResult = await runTriageStep(
    provider,
    customerMessage,
    catalog,
    opts?.fallbackProvider,
    opts?.step1Model
  )
  result.triage = triageResult
  callbacks?.onTriageComplete?.(triageResult)

  // Match entries from knowledge base
  const matchedEntries: MatchedEntry[] = []
  for (const id of triageResult.matched_ids) {
    const entry = knowledgeEntries.find(e => e.id === id && !e.deleted)
    if (entry) {
      matchedEntries.push({ entry, score: 1 })
    }
  }
  result.matchedEntries = matchedEntries
  callbacks?.onMatchComplete?.(matchedEntries)

  // Override to HUMAN if forced
  const isHuman = opts?.forceHuman || triageResult.triage.decision === 'HUMAN'
  result.suggestedStrategy = triageResult.suggested_strategy || null

  // ===== Step 2: Generate reply (for both AUTO and HUMAN paths) =====
  // AUTO: generate for sending
  // HUMAN: generate as draft for human reference
  const detectedLang = triageResult.detected_language
  const useLang = targetLanguage === 'auto' ? (detectedLang || 'en') : targetLanguage

  let streamingReply = ''

  const step2Result = await runStep2(
    provider,
    customerMessage,
    triageResult.chinese_translation,
    triageResult.intent,
    matchedEntries,
    useLang,
    opts?.promptB,
    opts?.step2Model,
    {
      onToken: (token) => {
        streamingReply += token
        result.streamingReply = streamingReply
        callbacks?.onGenerationToken?.(token)
      },
      onComplete: () => {},
    }
  )
  result.step2Result = step2Result
  callbacks?.onGenerationComplete?.(step2Result)

  // ===== Step 3: Quality Check (only for AUTO path) =====
  if (!isHuman && step2Result) {
    const qc = runQualityCheck(step2Result.reply, detectedLang)
    result.qualityCheck = qc
    callbacks?.onQualityCheck?.(qc)

    if (qc.pass) {
      result.decision = 'AUTO'
    } else {
      // Quality check failed → downgrade to HUMAN
      result.decision = 'QUALITY_FAIL'
      result.suggestedStrategy =
        `质检未通过: ${qc.failReasons.join('; ')}。${result.suggestedStrategy || '请人工审核后发送。'}`
    }
  } else {
    result.decision = 'HUMAN'
  }
  callbacks?.onDecision?.(result.decision)

  // ===== Log to daily =====
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const scriptTitle = matchedEntries[0]?.entry.title || '（无匹配）'
  const outcomeMap: Record<PipelineDecision, string> = {
    AUTO: '✅ 自动回复',
    HUMAN: '→ 人工处理',
    QUALITY_FAIL: '⚠️ 质检未通过→人工',
  }

  appendDailyLog({
    time: timeStr,
    lang: detectedLang || '??',
    intent: triageResult.intent || '未知',
    decision: result.decision,
    scriptTitle,
    outcome: outcomeMap[result.decision],
  }).catch(err => console.warn('[Pipeline] Failed to write daily log:', err))

  return result
}
