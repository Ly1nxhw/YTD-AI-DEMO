import { useState } from 'react'
import { X, BookOpen, Loader2, Check, Trash2, Save, Sparkles } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { extractScriptsFromChat, type ExtractedScript } from '@/lib/llm-adapter'

interface ConversationLearnerProps {
  onClose: () => void
}

export default function ConversationLearner({ onClose }: ConversationLearnerProps) {
  const settings = useSettingsStore(s => s.settings)
  const addEntry = useKnowledgeStore(s => s.addEntry)

  const [chatText, setChatText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedScript[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')

  const handleExtract = async () => {
    if (!chatText.trim()) return
    setExtracting(true)
    setError('')
    setExtracted([])
    setSavedCount(0)
    try {
      const results = await extractScriptsFromChat(
        settings.llmProvider,
        chatText,
        settings.step1Model || undefined
      )
      if (results.length === 0) {
        setError('未能从聊天记录中提取到有效话术，请检查内容是否包含客服对话。')
      } else {
        setExtracted(results)
        setSelected(new Set(results.map((_, i) => i)))
      }
    } catch (err: any) {
      setError(err.message || '提取失败，请检查 LLM 配置')
    } finally {
      setExtracting(false)
    }
  }

  const toggleSelect = (idx: number) => {
    const newSet = new Set(selected)
    if (newSet.has(idx)) newSet.delete(idx)
    else newSet.add(idx)
    setSelected(newSet)
  }

  const toggleAll = () => {
    if (selected.size === extracted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(extracted.map((_, i) => i)))
    }
  }

  const handleSaveSelected = async () => {
    setSaving(true)
    let count = 0
    for (const idx of Array.from(selected).sort()) {
      const s = extracted[idx]
      await addEntry({
        category: s.category,
        title: s.title,
        content: s.content,
        keywords: s.keywords,
        scenario: s.scenario || s.category,
      })
      count++
    }
    setSavedCount(count)
    setSaving(false)
  }

  const updateExtracted = (idx: number, field: keyof ExtractedScript, value: string) => {
    setExtracted(prev => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'keywords') {
        return { ...item, keywords: value.split(/[,，、\s]+/).filter(Boolean) }
      }
      return { ...item, [field]: value }
    }))
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-purple-600" />
          从对话学习话术
        </h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Step 1: Paste chat */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">1</span>
            <span className="text-xs font-medium text-gray-700">粘贴亚马逊聊天记录</span>
          </div>
          <textarea
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            placeholder={"将亚马逊后台的聊天记录直接粘贴到此处...\n\n支持任意格式，例如：\n\nCustomer (2024-01-15): I received a damaged product...\nAgent: Dear customer, we are sorry to hear...\n\n或者直接复制整段对话即可，AI 会自动识别。"}
            rows={8}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 bg-gray-50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {chatText.length > 0 ? `${chatText.length} 字符` : '支持任意语言的聊天记录'}
            </span>
            <button
              onClick={handleExtract}
              disabled={!chatText.trim() || extracting}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
            >
              {extracting ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> AI 分析中...</>
              ) : (
                <><Sparkles className="w-3 h-3" /> 提取话术</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Step 2: Review extracted scripts */}
        {extracted.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">2</span>
                <span className="text-xs font-medium text-gray-700">
                  确认话术（AI 提取到 {extracted.length} 条）
                </span>
              </div>
              <button
                onClick={toggleAll}
                className="text-[10px] text-purple-600 hover:underline"
              >
                {selected.size === extracted.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="space-y-2.5">
              {extracted.map((script, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    selected.has(idx) ? 'border-purple-300 bg-purple-50/30' : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Script header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100">
                    <button
                      onClick={() => toggleSelect(idx)}
                      className={`w-4 h-4 rounded border flex items-center justify-center text-white transition-colors ${
                        selected.has(idx) ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {selected.has(idx) && <Check className="w-3 h-3" />}
                    </button>
                    <input
                      value={script.title}
                      onChange={e => updateExtracted(idx, 'title', e.target.value)}
                      className="flex-1 text-xs font-medium text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 px-0"
                    />
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded shrink-0">
                      {script.category}
                    </span>
                  </div>

                  {/* Script body */}
                  <div className="px-3 py-2 space-y-1.5">
                    {/* Customer example */}
                    <div>
                      <span className="text-[10px] text-gray-400">客户消息示例：</span>
                      <p className="text-[11px] text-gray-500 italic">{script.customerExample}</p>
                    </div>
                    {/* Editable content */}
                    <div>
                      <span className="text-[10px] text-gray-400">话术模板：</span>
                      <textarea
                        value={script.content}
                        onChange={e => updateExtracted(idx, 'content', e.target.value)}
                        rows={3}
                        className="w-full mt-0.5 px-2 py-1.5 text-[11px] text-gray-700 border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 leading-relaxed"
                      />
                    </div>
                    {/* Keywords */}
                    <div className="flex flex-wrap gap-1">
                      {script.keywords.map((kw, ki) => (
                        <span key={ki} className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Save bar */}
            <div className="mt-4 flex items-center justify-between">
              {savedCount > 0 ? (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3.5 h-3.5" />
                  已保存 {savedCount} 条话术到知识库
                </div>
              ) : (
                <span className="text-[10px] text-gray-400">
                  已选 {selected.size} / {extracted.length} 条
                </span>
              )}
              <button
                onClick={handleSaveSelected}
                disabled={selected.size === 0 || saving || savedCount > 0}
                className="px-4 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
              >
                {saving ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> 保存中...</>
                ) : savedCount > 0 ? (
                  <><Check className="w-3 h-3" /> 已保存</>
                ) : (
                  <><Save className="w-3 h-3" /> 批量保存到话术库</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
