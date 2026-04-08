import { useState } from 'react'
import { Send, Loader2, Copy, CheckCircle, AlertTriangle, Pencil, RotateCcw, Save } from 'lucide-react'
import { useGenerationStore } from '@/stores/generation-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { SUPPORTED_LANGUAGES } from '@/types'
import VariableFillPanel from './VariableFillPanel'

interface MainPanelProps {
  isCompact?: boolean
}

export default function MainPanel({ isCompact = false }: MainPanelProps) {
  const {
    customerMessage,
    setCustomerMessage,
    selectedLanguage,
    status,
    step1Result,
    matchedEntries,
    step2Result,
    streamingReply,
    error,
    editedReply,
    setEditedReply,
    isDraft,
    generateReply,
    reset,
    confirmCopy,
  } = useGenerationStore()

  const addEntry = useKnowledgeStore(s => s.addEntry)

  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editedChinese, setEditedChinese] = useState('')
  const [matchCopyFeedback, setMatchCopyFeedback] = useState<number | null>(null)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saveCategory, setSaveCategory] = useState('')

  const isProcessing = status === 'step1' || status === 'matching' || status === 'step2'

  const detectedLang = step1Result?.detected_language
  const targetLangCode = selectedLanguage === 'auto' ? (detectedLang || 'en') : selectedLanguage
  const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode)

  const handleGenerate = () => {
    setCopied(false)
    setIsEditing(false)
    generateReply()
  }

  const handleConfirmCopy = async () => {
    await confirmCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyMatched = async (text: string, idx: number) => {
    await window.electronAPI?.copyToClipboard(text)
    setMatchCopyFeedback(idx)
    setTimeout(() => setMatchCopyFeedback(null), 1500)
  }

  const handleSaveAsScript = async () => {
    if (!saveTitle || !step2Result) return
    await addEntry({
      category: saveCategory || '其他类',
      title: saveTitle,
      content: step2Result.chinese || editedReply,
      keywords: step1Result?.keywords || [],
      scenario: saveCategory || '其他类',
    })
    setShowSaveForm(false)
    setSaveTitle('')
    setSaveCategory('')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Customer message input */}
      <div className={`border-b border-gray-200 bg-white ${isCompact ? 'p-2' : 'p-4'}`}>
        {!isCompact && <label className="text-xs font-medium text-gray-500 mb-1.5 block">客户消息</label>}
        <div className="relative">
          <textarea
            value={customerMessage}
            onChange={e => setCustomerMessage(e.target.value)}
            placeholder="粘贴客户消息..."
            rows={isCompact ? 2 : 3}
            className={`w-full border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${isCompact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
            disabled={isProcessing}
          />
          <div className={`flex items-center justify-between ${isCompact ? 'mt-1' : 'mt-2'}`}>
            <div className={`flex items-center gap-2 text-gray-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              {detectedLang && (
                <span>
                  {langInfo?.flag} {isCompact ? detectedLang : (langInfo?.name || detectedLang)}
                </span>
              )}
              {step1Result?.intent && !isCompact && (
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                  {step1Result.intent}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={reset}
                className={`text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1 ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
                disabled={isProcessing}
              >
                <RotateCcw className="w-3 h-3" />
                {!isCompact && '重置'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={!customerMessage.trim() || isProcessing}
                className={`bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 ${isCompact ? 'px-2.5 py-1 text-[10px]' : 'px-4 py-1.5 text-xs'}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                {isCompact
                  ? (isProcessing ? '...' : '生成')
                  : (status === 'step1' ? '分析中...' : status === 'matching' ? '匹配中...' : status === 'step2' ? '生成中...' : '生成回复')
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content area - scrollable */}
      <div className={`flex-1 overflow-y-auto space-y-3 ${isCompact ? 'p-2' : 'p-4 space-y-4'}`}>
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Matched scripts */}
        {matchedEntries.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-2">匹配话术</h3>
            <div className="space-y-2">
              {matchedEntries.map((match, idx) => (
                <div key={match.entry.id} className="flex items-start gap-2 p-2.5 bg-white border border-gray-200 rounded-lg">
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{match.entry.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{match.entry.content.slice(0, 100)}...</p>
                  </div>
                  <button
                    onClick={() => handleCopyMatched(match.entry.content, idx)}
                    className="shrink-0 px-2 py-1 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                  >
                    {matchCopyFeedback === idx ? '已复制' : '复制'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched warning */}
        {step2Result?.unmatched && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
              <AlertTriangle className="w-4 h-4" />
              话术库未覆盖此场景（AI 基于通用能力生成，请仔细核对）
            </div>
            {!showSaveForm ? (
              <button
                onClick={() => setShowSaveForm(true)}
                className="mt-2 flex items-center gap-1 px-2.5 py-1 text-[11px] text-amber-700 bg-amber-100 rounded hover:bg-amber-200"
              >
                <Save className="w-3 h-3" />
                将此回复保存为新话术
              </button>
            ) : (
              <div className="mt-2 space-y-1.5">
                <input
                  placeholder="话术标题"
                  value={saveTitle}
                  onChange={e => setSaveTitle(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded"
                />
                <input
                  placeholder="分类（默认：其他类）"
                  value={saveCategory}
                  onChange={e => setSaveCategory(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded"
                />
                <div className="flex gap-1">
                  <button onClick={handleSaveAsScript} className="px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded">保存</button>
                  <button onClick={() => setShowSaveForm(false)} className="px-2 py-0.5 text-[10px] bg-gray-200 rounded">取消</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Generated Reply */}
        {(step2Result || streamingReply) && (
          <div>
            <h3 className={`font-medium text-gray-500 mb-2 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>AI 生成回复</h3>

            {isCompact ? (
              /* Compact: single column, reply only */
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="p-2">
                  {isEditing ? (
                    <textarea
                      value={editedReply}
                      onChange={e => setEditedReply(e.target.value)}
                      className="w-full min-h-[80px] text-xs border border-blue-300 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {step2Result?.reply || streamingReply}
                      {status === 'step2' && <span className="animate-pulse">|</span>}
                    </p>
                  )}
                  {step2Result && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-blue-600"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        {isEditing ? '完成' : '编辑'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Full: dual column layout */
              <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Left: Foreign language reply */}
                <div className="border-r border-gray-200">
                  <div className="px-3 py-1.5 bg-blue-50 border-b border-gray-200">
                    <span className="text-[11px] font-medium text-blue-700">
                      {langInfo?.flag} {langInfo?.name || '外语'}回复
                    </span>
                  </div>
                  <div className="p-3">
                    {isEditing ? (
                      <textarea
                        value={editedReply}
                        onChange={e => setEditedReply(e.target.value)}
                        className="w-full min-h-[120px] text-sm border border-blue-300 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {step2Result?.reply || streamingReply}
                        {status === 'step2' && <span className="animate-pulse">|</span>}
                      </p>
                    )}
                    {step2Result && (
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-600"
                      >
                        <Pencil className="w-3 h-3" />
                        {isEditing ? '完成编辑' : '编辑'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: Chinese translation */}
                <div>
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-[11px] font-medium text-gray-600">中文对照</span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {editedChinese || step2Result?.chinese || ''}
                      {status === 'step2' && !step2Result?.chinese && (
                        <span className="text-gray-400 text-xs">生成中...</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Variable fill panel — only appears when {{变量}} detected */}
            {step2Result && (
              <div className={`${isCompact ? 'mt-2' : 'mt-3'}`}>
                <VariableFillPanel
                  replyText={editedReply || step2Result.reply}
                  chineseText={editedChinese || step2Result.chinese}
                  targetLang={targetLangCode}
                  onFill={(filledReply, filledChinese) => { setEditedReply(filledReply); setEditedChinese(filledChinese) }}
                  isCompact={isCompact}
                />
              </div>
            )}

            {/* Confirm & Copy button */}
            {step2Result && (
              <div className={`flex justify-center ${isCompact ? 'mt-2' : 'mt-3'}`}>
                <button
                  onClick={handleConfirmCopy}
                  className={`font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    isCompact ? 'px-3 py-1.5 text-xs' : 'px-6 py-2 text-sm'
                  } ${
                    copied
                      ? 'bg-green-600 text-white'
                      : isDraft
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircle className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                      {isCompact ? '已复制' : '已复制到剪贴板'}
                    </>
                  ) : (
                    <>
                      <Copy className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                      {isCompact ? '复制回复' : '确认并复制回复'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Processing status indicator */}
        {isProcessing && !streamingReply && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm">
                {status === 'step1' && '正在分析客户消息...'}
                {status === 'matching' && '正在匹配话术库...'}
                {status === 'step2' && '正在生成回复...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
