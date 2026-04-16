import { useState, useEffect } from 'react'
import { ClipboardPaste, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { getGapSummary } from '@/agent/gap-tracker'

export default function StatusBar() {
  const settings = useSettingsStore(s => s.settings)
  const knowledgeBase = useKnowledgeStore(s => s.knowledgeBase)
  const workspace = useWorkspaceStore(s => s.workspace)
  const [clipboardWatch, setClipboardWatch] = useState(false)
  const [gapSummary, setGapSummary] = useState<{ intent: string; count: number }[]>([])
  const [showGaps, setShowGaps] = useState(false)

  useEffect(() => {
    window.electronAPI.clipboardWatchStatus().then(setClipboardWatch)
    // Refresh gap summary every 10s
    const refresh = () => setGapSummary(getGapSummary())
    refresh()
    const timer = setInterval(refresh, 10000)
    return () => clearInterval(timer)
  }, [])

  const toggleClipboardWatch = async () => {
    if (clipboardWatch) {
      await window.electronAPI.clipboardWatchStop()
      setClipboardWatch(false)
    } else {
      await window.electronAPI.clipboardWatchStart()
      setClipboardWatch(true)
    }
  }

  const entryCount = knowledgeBase?.entries.filter(e => !e.deleted).length ?? 0
  const providerName = settings.llmProvider.name || '未配置'
  const model = settings.llmProvider.model || '未设置'
  const hasApiKey = !!settings.llmProvider.apiKey || settings.llmProvider.apiUrl.includes('localhost')

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 border-t border-gray-200 text-[11px] text-gray-500">
      <div className="flex items-center gap-4">
        <span>工作区: {workspace?.name || '未加载'}</span>
        <span>
          {hasApiKey ? '✅' : '⚠️'} {providerName}
        </span>
        <span>模型: {model}</span>
      </div>
      <div className="flex items-center gap-3 relative">
        <span>话术库: {entryCount} 条</span>
        {gapSummary.length > 0 && (
          <button
            onClick={() => setShowGaps(!showGaps)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
            title="话术库缺口提示"
          >
            <AlertCircle className="w-3 h-3" />
            缺口 {gapSummary.reduce((s, g) => s + g.count, 0)}
          </button>
        )}
        <button
          onClick={toggleClipboardWatch}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
            clipboardWatch
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }`}
          title={clipboardWatch ? '剪贴板监听中（点击关闭）' : '开启剪贴板监听'}
        >
          <ClipboardPaste className="w-3 h-3" />
          {clipboardWatch ? '监听中' : '监听'}
        </button>

        {/* Gap summary popup */}
        {showGaps && gapSummary.length > 0 && (
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">话术库缺口</span>
              <button onClick={() => setShowGaps(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            <p className="text-[10px] text-gray-500 mb-2">以下场景未匹配到话术，建议补充：</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gapSummary.slice(0, 10).map((g, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-700 truncate flex-1">{g.intent}</span>
                  <span className="text-amber-600 font-medium ml-2">{g.count}次</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
