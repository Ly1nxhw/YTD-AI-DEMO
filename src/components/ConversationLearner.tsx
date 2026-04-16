import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  GitCompare,
  History,
  Loader2,
  PlusCircle,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { extractScriptsFromChat, type ExtractedScript } from '@/lib/llm-adapter'
import { buildLearnedScriptCandidate } from '@/lib/learning-validator'
import { suggestKnowledgeMerge } from '@/lib/knowledge-merge'
import type { KnowledgeEntry, LearnedScriptCandidate, LearningSession } from '@/types'

interface ConversationLearnerProps {
  onClose: () => void
}

function getActiveEntries(knowledgeBase: { entries: KnowledgeEntry[] } | null): KnowledgeEntry[] {
  return knowledgeBase?.entries.filter(entry => !entry.deleted) ?? []
}

function buildCandidates(
  scripts: ExtractedScript[],
  entries: KnowledgeEntry[]
): LearnedScriptCandidate[] {
  const seed = Date.now()
  return scripts.map((script, index) =>
    buildLearnedScriptCandidate(
      `learned-${seed}-${index}`,
      script,
      suggestKnowledgeMerge(script, entries)
    )
  )
}

function getScoreTone(score: number): string {
  if (score >= 85) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (score >= 70) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-red-50 text-red-700 border-red-200'
}

function getActionLabel(action: LearnedScriptCandidate['chosenAction']): string {
  if (action === 'create') return '新建'
  if (action === 'update_existing') return '更新已有'
  return '忽略'
}

function formatKeywords(values: string[]): string {
  return values.join(', ')
}

function splitNormalizedKeywords(value: string): string[] {
  return value
    .split(/[\s,\uFF0C\u3001]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeForCompare(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function hasChanged(left: string, right: string): boolean {
  return normalizeForCompare(left) !== normalizeForCompare(right)
}

function DiffRow({
  label,
  currentValue,
  nextValue,
}: {
  label: string
  currentValue: string
  nextValue: string
}) {
  const changed = hasChanged(currentValue, nextValue)
  return (
    <div className="grid gap-2 rounded-lg border border-gray-100 bg-white p-2 md:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">现有 {label}</div>
        <div className="min-h-[36px] rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] leading-5 text-gray-600">
          {currentValue || '空'}
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400">
          <span>学习结果</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              changed ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {changed ? '有变更' : '无变更'}
          </span>
        </div>
        <div
          className={`min-h-[36px] rounded border px-2 py-1.5 text-[11px] leading-5 ${
            changed
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-gray-100 bg-gray-50 text-gray-600'
          }`}
        >
          {nextValue || '空'}
        </div>
      </div>
    </div>
  )
}

export default function ConversationLearner({ onClose }: ConversationLearnerProps) {
  const settings = useSettingsStore(state => state.settings)
  const knowledgeBase = useKnowledgeStore(state => state.knowledgeBase)
  const addEntries = useKnowledgeStore(state => state.addEntries)
  const updateEntry = useKnowledgeStore(state => state.updateEntry)

  const [chatText, setChatText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [candidates, setCandidates] = useState<LearnedScriptCandidate[]>([])
  const [saving, setSaving] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [savedSummary, setSavedSummary] = useState<null | {
    created: number
    updated: number
    ignored: number
  }>(null)
  const [learningSessions, setLearningSessions] = useState<LearningSession[]>([])
  const [expandedDiffIds, setExpandedDiffIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const activeEntries = useMemo(() => getActiveEntries(knowledgeBase), [knowledgeBase])
  const actionableCount = candidates.filter(candidate => candidate.chosenAction !== 'ignore').length

  useEffect(() => {
    let disposed = false

    const loadLearningSessions = async () => {
      setHistoryLoading(true)
      try {
        const sessions = await window.electronAPI.readLearningSessions()
        if (!disposed) {
          setLearningSessions(sessions)
        }
      } finally {
        if (!disposed) {
          setHistoryLoading(false)
        }
      }
    }

    void loadLearningSessions()
    return () => {
      disposed = true
    }
  }, [])

  const handleExtract = async () => {
    if (!chatText.trim()) return

    setExtracting(true)
    setError('')
    setCandidates([])
    setExpandedDiffIds(new Set())
    setSavedSummary(null)

    try {
      const results = await extractScriptsFromChat(
        settings.llmProvider,
        chatText,
        settings.step1Model || undefined
      )

      if (results.length === 0) {
        setError('没有从这段对话中提取到可复用话术，请换一段更完整的客服对话。')
        return
      }

      const nextCandidates = buildCandidates(results, activeEntries)
      setCandidates(nextCandidates)
      setExpandedDiffIds(
        new Set(
          nextCandidates
            .filter(candidate => candidate.mergeSuggestion.action === 'update_existing')
            .map(candidate => candidate.id)
        )
      )
    } catch (err: any) {
      setError(err.message || '提取失败，请检查当前 LLM 配置。')
    } finally {
      setExtracting(false)
    }
  }

  const revalidateCandidate = (
    candidate: LearnedScriptCandidate,
    updates: Partial<ExtractedScript>
  ): LearnedScriptCandidate => {
    const script: ExtractedScript = {
      title: updates.title ?? candidate.title,
      category: updates.category ?? candidate.category,
      keywords: updates.keywords ?? candidate.keywords,
      content: updates.content ?? candidate.content,
      scenario: updates.scenario ?? candidate.scenario,
      customerExample: updates.customerExample ?? candidate.customerExample,
    }

    const rebuilt = buildLearnedScriptCandidate(
      candidate.id,
      script,
      suggestKnowledgeMerge(script, activeEntries)
    )

    return {
      ...rebuilt,
      chosenAction:
        rebuilt.flags.some(flag => flag.level === 'blocker')
          ? 'ignore'
          : candidate.chosenAction === 'ignore'
            ? rebuilt.chosenAction
            : candidate.chosenAction,
    }
  }

  const updateCandidateField = (
    candidateId: string,
    field: keyof ExtractedScript,
    value: string
  ) => {
    setCandidates(previous =>
      previous.map(candidate => {
        if (candidate.id !== candidateId) {
          return candidate
        }

        const updates: Partial<ExtractedScript> =
          field === 'keywords'
            ? {
                keywords: splitNormalizedKeywords(value),
              }
            : { [field]: value }

        return revalidateCandidate(candidate, updates)
      })
    )
  }

  const setCandidateAction = (
    candidateId: string,
    action: LearnedScriptCandidate['chosenAction']
  ) => {
    setCandidates(previous =>
      previous.map(candidate => {
        if (candidate.id !== candidateId) return candidate
        if (action === 'update_existing' && !candidate.mergeSuggestion.targetEntryId) {
          return candidate
        }
        if (candidate.flags.some(flag => flag.level === 'blocker') && action !== 'ignore') {
          return candidate
        }
        return { ...candidate, chosenAction: action }
      })
    )
  }

  const applyBulkAction = (action: LearnedScriptCandidate['chosenAction']) => {
    setCandidates(previous =>
      previous.map(candidate => {
        if (candidate.flags.some(flag => flag.level === 'blocker') && action !== 'ignore') {
          return { ...candidate, chosenAction: 'ignore' }
        }
        if (action === 'update_existing' && !candidate.mergeSuggestion.targetEntryId) {
          return { ...candidate, chosenAction: 'create' }
        }
        return { ...candidate, chosenAction: action }
      })
    )
  }

  const toggleDiff = (candidateId: string) => {
    setExpandedDiffIds(previous => {
      const next = new Set(previous)
      if (next.has(candidateId)) {
        next.delete(candidateId)
      } else {
        next.add(candidateId)
      }
      return next
    })
  }

  const handleSaveAll = async () => {
    if (saving) return

    const ignored = candidates.filter(candidate => candidate.chosenAction === 'ignore').length
    const createPayload = candidates
      .filter(candidate => candidate.chosenAction === 'create')
      .map(candidate => ({
        category: candidate.category.trim(),
        title: candidate.title.trim(),
        content: candidate.content.trim(),
        keywords: candidate.keywords.map(keyword => keyword.trim()).filter(Boolean),
        scenario: candidate.scenario.trim() || candidate.category.trim(),
        sourceType: 'conversation' as const,
        sourceRef: candidate.customerExample.trim().slice(0, 200),
        qualityScore: candidate.qualityScore,
        reviewStatus: 'reviewed' as const,
        updatedByLearning: true,
      }))

    const updatePayload = candidates.filter(
      candidate =>
        candidate.chosenAction === 'update_existing' &&
        !!candidate.mergeSuggestion.targetEntryId
    )

    setSaving(true)
    setError('')

    try {
      if (createPayload.length > 0) {
        await addEntries(createPayload)
      }

      for (const candidate of updatePayload) {
        const target = activeEntries.find(
          entry => entry.id === candidate.mergeSuggestion.targetEntryId
        )
        if (!target) {
          continue
        }

        await updateEntry(target.id, {
          title: candidate.title.trim(),
          category: candidate.category.trim(),
          content: candidate.content.trim(),
          scenario: candidate.scenario.trim() || candidate.category.trim(),
          keywords: Array.from(
            new Set([
              ...target.keywords,
              ...candidate.keywords.map(keyword => keyword.trim()).filter(Boolean),
            ])
          ),
          sourceType: 'conversation',
          sourceRef: candidate.customerExample.trim().slice(0, 200),
          qualityScore: candidate.qualityScore,
          reviewStatus: 'reviewed',
          updatedByLearning: true,
        })
      }

      const session: LearningSession = {
        id: `learning-${Date.now()}`,
        sourceType: 'conversation',
        createdAt: new Date().toISOString(),
        sourcePreview: chatText.trim().replace(/\s+/g, ' ').slice(0, 160),
        candidateCount: candidates.length,
        createdCount: createPayload.length,
        updatedCount: updatePayload.length,
        ignoredCount: ignored,
        decisions: candidates.map(candidate => ({
          candidateId: candidate.id,
          title: candidate.title.trim(),
          action: candidate.chosenAction,
          qualityScore: candidate.qualityScore,
          targetEntryId: candidate.mergeSuggestion.targetEntryId,
          targetEntryTitle: candidate.mergeSuggestion.targetEntryTitle,
        })),
      }

      await window.electronAPI.appendLearningSession(session)
      setLearningSessions(previous => [session, ...previous].slice(0, 20))
      setSavedSummary({
        created: createPayload.length,
        updated: updatePayload.length,
        ignored,
      })
    } catch (err: any) {
      setError(err.message || '保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <BookOpen className="h-4 w-4 text-purple-600" />
          从对话学习话术
        </h2>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-gray-100 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
              1
            </span>
            <span className="text-xs font-medium text-gray-700">粘贴一段客服对话</span>
          </div>

          <textarea
            value={chatText}
            onChange={event => setChatText(event.target.value)}
            placeholder={`把完整的客服对话粘贴到这里。\n\n建议至少包含：\n1. 客户问题\n2. 客服回复\n3. 一轮以上追问或解释\n\n系统会自动抽取可复用话术，并给出新建或更新建议。`}
            rows={9}
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {chatText.trim() ? `${chatText.length} 字符` : '支持中英文和混合格式对话记录'}
            </span>
            <button
              onClick={handleExtract}
              disabled={!chatText.trim() || extracting}
              className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI 分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  抽取并审阅
                </>
              )}
            </button>
          </div>
        </div>

        <div className="border-b border-gray-100 bg-gray-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
            <History className="h-3.5 w-3.5 text-gray-500" />
            最近学习记录
          </div>
          {historyLoading ? (
            <div className="text-[11px] text-gray-500">加载中...</div>
          ) : learningSessions.length === 0 ? (
            <div className="text-[11px] text-gray-500">当前工作区还没有学习记录。</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {learningSessions.slice(0, 6).map(session => (
                <div key={session.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-[11px] font-medium text-gray-700">
                    {new Date(session.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1 line-clamp-3 text-[11px] leading-5 text-gray-500">
                    {session.sourcePreview || '无来源摘要'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
                      候选 {session.candidateCount}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      新增 {session.createdCount}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                      更新 {session.updatedCount}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      忽略 {session.ignoredCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        {candidates.length > 0 && (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
                  2
                </span>
                <span className="text-xs font-medium text-gray-700">
                  审阅候选话术（共 {candidates.length} 条）
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <button
                  onClick={() => applyBulkAction('create')}
                  className="rounded border border-gray-200 px-2 py-1 text-gray-600 hover:border-purple-200 hover:text-purple-700"
                >
                  全部新建
                </button>
                <button
                  onClick={() => applyBulkAction('update_existing')}
                  className="rounded border border-gray-200 px-2 py-1 text-gray-600 hover:border-purple-200 hover:text-purple-700"
                >
                  尽量更新已有
                </button>
                <button
                  onClick={() => applyBulkAction('ignore')}
                  className="rounded border border-gray-200 px-2 py-1 text-gray-600 hover:border-red-200 hover:text-red-600"
                >
                  全部忽略
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {candidates.map(candidate => {
                const hasBlockers = candidate.flags.some(flag => flag.level === 'blocker')
                const targetEntry = candidate.mergeSuggestion.targetEntryId
                  ? activeEntries.find(entry => entry.id === candidate.mergeSuggestion.targetEntryId)
                  : null
                const showDiff = !!targetEntry && expandedDiffIds.has(candidate.id)

                return (
                  <div
                    key={candidate.id}
                    className={`overflow-hidden rounded-xl border ${
                      candidate.chosenAction === 'ignore'
                        ? 'border-gray-200 bg-gray-50/70'
                        : 'border-purple-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3 py-2">
                      <input
                        value={candidate.title}
                        onChange={event =>
                          updateCandidateField(candidate.id, 'title', event.target.value)
                        }
                        className="min-w-[220px] flex-1 bg-transparent px-0 text-xs font-medium text-gray-800 focus:outline-none"
                      />
                      <input
                        value={candidate.category}
                        onChange={event =>
                          updateCandidateField(candidate.id, 'category', event.target.value)
                        }
                        className="w-28 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-purple-300 focus:outline-none"
                      />
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${getScoreTone(candidate.qualityScore)}`}
                      >
                        质量分 {candidate.qualityScore}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                        当前动作: {getActionLabel(candidate.chosenAction)}
                      </span>
                    </div>

                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-[10px] text-gray-400">客户表达示例</div>
                          <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-[11px] leading-5 text-gray-600">
                            {candidate.customerExample || '未提取到客户示例'}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] text-gray-400">适用场景</div>
                          <textarea
                            value={candidate.scenario}
                            onChange={event =>
                              updateCandidateField(candidate.id, 'scenario', event.target.value)
                            }
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 focus:border-purple-300 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] text-gray-400">话术正文</div>
                        <textarea
                          value={candidate.content}
                          onChange={event =>
                            updateCandidateField(candidate.id, 'content', event.target.value)
                          }
                          rows={5}
                          className="w-full resize-none rounded-lg border border-gray-200 px-2 py-2 text-[11px] leading-5 text-gray-700 focus:border-purple-300 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] text-gray-400">关键词</div>
                        <input
                          value={formatKeywords(candidate.keywords)}
                          onChange={event =>
                            updateCandidateField(candidate.id, 'keywords', event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 focus:border-purple-300 focus:outline-none"
                        />
                      </div>

                      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                          <span className="font-medium text-gray-700">系统建议</span>
                          <span className="rounded bg-white px-2 py-0.5 text-[10px] text-gray-600">
                            {candidate.mergeSuggestion.action === 'update_existing'
                              ? `建议更新: ${candidate.mergeSuggestion.targetEntryTitle ?? '已有条目'}`
                              : '建议新建'}
                          </span>
                          <span className="rounded bg-white px-2 py-0.5 text-[10px] text-gray-600">
                            置信度 {Math.round(candidate.mergeSuggestion.confidence * 100)}%
                          </span>
                          {targetEntry && (
                            <button
                              onClick={() => toggleDiff(candidate.id)}
                              className="ml-auto flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 hover:border-purple-200 hover:text-purple-700"
                            >
                              <GitCompare className="h-3 w-3" />
                              查看差异
                              {showDiff ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {candidate.mergeSuggestion.reasons.join(' ')}
                        </div>
                      </div>

                      {showDiff && targetEntry && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                          <div className="mb-2 text-[11px] font-medium text-blue-800">
                            更新前后对比: {targetEntry.title}
                          </div>
                          <div className="space-y-2">
                            <DiffRow
                              label="标题"
                              currentValue={targetEntry.title}
                              nextValue={candidate.title}
                            />
                            <DiffRow
                              label="分类"
                              currentValue={targetEntry.category}
                              nextValue={candidate.category}
                            />
                            <DiffRow
                              label="场景"
                              currentValue={targetEntry.scenario}
                              nextValue={candidate.scenario}
                            />
                            <DiffRow
                              label="关键词"
                              currentValue={formatKeywords(targetEntry.keywords)}
                              nextValue={formatKeywords(
                                Array.from(new Set([...targetEntry.keywords, ...candidate.keywords]))
                              )}
                            />
                            <DiffRow
                              label="正文"
                              currentValue={targetEntry.content}
                              nextValue={candidate.content}
                            />
                          </div>
                        </div>
                      )}

                      {candidate.flags.length > 0 && (
                        <div className="space-y-1">
                          {candidate.flags.map(flag => (
                            <div
                              key={`${candidate.id}-${flag.code}`}
                              className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                                flag.level === 'blocker'
                                  ? 'bg-red-50 text-red-700'
                                  : flag.level === 'warning'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{flag.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => setCandidateAction(candidate.id, 'create')}
                          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] ${
                            candidate.chosenAction === 'create'
                              ? 'bg-purple-600 text-white'
                              : 'border border-gray-200 text-gray-600'
                          }`}
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          新建
                        </button>
                        <button
                          onClick={() => setCandidateAction(candidate.id, 'update_existing')}
                          disabled={!candidate.mergeSuggestion.targetEntryId || hasBlockers}
                          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] ${
                            candidate.chosenAction === 'update_existing'
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 text-gray-600'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          更新已有
                        </button>
                        <button
                          onClick={() => setCandidateAction(candidate.id, 'ignore')}
                          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] ${
                            candidate.chosenAction === 'ignore'
                              ? 'bg-gray-700 text-white'
                              : 'border border-gray-200 text-gray-600'
                          }`}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          忽略
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {savedSummary ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-3.5 w-3.5" />
                    已处理 {savedSummary.created + savedSummary.updated} 条，新增 {savedSummary.created} 条，更新{' '}
                    {savedSummary.updated} 条，忽略 {savedSummary.ignored} 条。
                  </span>
                ) : (
                  <span>
                    当前可执行 {actionableCount} 条，忽略 {candidates.length - actionableCount} 条。
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveAll}
                disabled={actionableCount === 0 || saving}
                className="flex items-center gap-1 rounded-md bg-purple-600 px-4 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    批量写入知识库
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
