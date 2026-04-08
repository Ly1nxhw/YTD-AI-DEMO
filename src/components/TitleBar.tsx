import { useState, useEffect } from 'react'
import { Pin, PinOff, Settings, Bot } from 'lucide-react'
import { useGenerationStore } from '@/stores/generation-store'
import { SUPPORTED_LANGUAGES } from '@/types'

interface TitleBarProps {
  onOpenSettings: () => void
}

export default function TitleBar({ onOpenSettings }: TitleBarProps) {
  const [isOnTop, setIsOnTop] = useState(false)
  const selectedLanguage = useGenerationStore(s => s.selectedLanguage)
  const setSelectedLanguage = useGenerationStore(s => s.setSelectedLanguage)

  useEffect(() => {
    window.electronAPI?.getAlwaysOnTop().then(setIsOnTop)
  }, [])

  const togglePin = async () => {
    const result = await window.electronAPI?.toggleAlwaysOnTop()
    setIsOnTop(result ?? false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 drag-region">
      <div className="flex items-center gap-2 no-drag">
        <Bot className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-gray-800 text-sm">AI 客服助手</span>
      </div>

      <div className="flex items-center gap-3 no-drag">
        {/* Language selector */}
        <select
          value={selectedLanguage}
          onChange={e => setSelectedLanguage(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>

        {/* Pin button */}
        <button
          onClick={togglePin}
          className={`p-1.5 rounded-md transition-colors ${
            isOnTop
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title={isOnTop ? '取消置顶' : '窗口置顶'}
        >
          {isOnTop ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
