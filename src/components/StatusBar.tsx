import { useSettingsStore } from '@/stores/settings-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'

export default function StatusBar() {
  const settings = useSettingsStore(s => s.settings)
  const knowledgeBase = useKnowledgeStore(s => s.knowledgeBase)

  const entryCount = knowledgeBase?.entries.filter(e => !e.deleted).length ?? 0
  const providerName = settings.llmProvider.name || '未配置'
  const model = settings.llmProvider.model || '未设置'
  const hasApiKey = !!settings.llmProvider.apiKey || settings.llmProvider.apiUrl.includes('localhost')

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 border-t border-gray-200 text-[11px] text-gray-500">
      <div className="flex items-center gap-4">
        <span>
          {hasApiKey ? '✅' : '⚠️'} {providerName}
        </span>
        <span>模型: {model}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>话术库: {entryCount} 条</span>
      </div>
    </div>
  )
}
