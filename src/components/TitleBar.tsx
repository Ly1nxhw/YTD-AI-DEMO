import { useState, useEffect, useRef } from 'react'
import { Pin, PinOff, Settings, Bot, Minimize2, Maximize2, Eye, BarChart3 } from 'lucide-react'
import { useGenerationStore } from '@/stores/generation-store'
import { SUPPORTED_LANGUAGES } from '@/types'

interface TitleBarProps {
  onOpenSettings: () => void
  onOpenStats: () => void
  isCompact: boolean
  onCompactChange: (compact: boolean) => void
}

export default function TitleBar({ onOpenSettings, onOpenStats, isCompact, onCompactChange }: TitleBarProps) {
  const [isOnTop, setIsOnTop] = useState(false)
  const [opacity, setOpacity] = useState(1.0)
  const [showOpacitySlider, setShowOpacitySlider] = useState(false)
  const opacityRef = useRef<HTMLDivElement>(null)
  const selectedLanguage = useGenerationStore(s => s.selectedLanguage)
  const setSelectedLanguage = useGenerationStore(s => s.setSelectedLanguage)

  useEffect(() => {
    window.electronAPI?.getAlwaysOnTop().then(setIsOnTop)
    window.electronAPI?.getOpacity().then(setOpacity)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (opacityRef.current && !opacityRef.current.contains(e.target as Node)) {
        setShowOpacitySlider(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const togglePin = async () => {
    const result = await window.electronAPI?.toggleAlwaysOnTop()
    setIsOnTop(result ?? false)
  }

  const toggleCompact = async () => {
    const result = await window.electronAPI?.toggleCompactMode()
    const newCompact = result ?? false
    onCompactChange(newCompact)
    if (newCompact) setIsOnTop(true)
  }

  const handleOpacityChange = async (value: number) => {
    setOpacity(value)
    await window.electronAPI?.setOpacity(value)
  }

  return (
    <div className={`flex items-center justify-between bg-white border-b border-gray-200 drag-region ${isCompact ? 'px-2 py-1' : 'px-4 py-2'}`}>
      <div className="flex items-center gap-1.5 no-drag">
        <Bot className={`text-blue-600 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
        {!isCompact && <span className="font-semibold text-gray-800 text-sm">AI 客服助手</span>}
      </div>

      <div className="flex items-center gap-1.5 no-drag">
        {/* Language selector */}
        <select
          value={selectedLanguage}
          onChange={e => setSelectedLanguage(e.target.value)}
          className={`border border-gray-300 rounded-md bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 ${isCompact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {isCompact ? lang.flag : `${lang.flag} ${lang.name}`}
            </option>
          ))}
        </select>

        {/* Opacity control */}
        <div className="relative" ref={opacityRef}>
          <button
            onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            className={`p-1 rounded-md transition-colors ${opacity < 1 ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            title={`透明度 ${Math.round(opacity * 100)}%`}
          >
            <Eye className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          </button>
          {showOpacitySlider && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-44">
              <div className="text-[10px] text-gray-500 mb-1.5">窗口透明度 {Math.round(opacity * 100)}%</div>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={opacity}
                onChange={e => handleOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-blue-500"
              />
            </div>
          )}
        </div>

        {/* Compact mode toggle */}
        <button
          onClick={toggleCompact}
          className={`p-1 rounded-md transition-colors ${
            isCompact
              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title={isCompact ? '退出小窗模式' : '小窗模式'}
        >
          {isCompact
            ? <Maximize2 className="w-3.5 h-3.5" />
            : <Minimize2 className="w-4 h-4" />
          }
        </button>

        {/* Pin button */}
        <button
          onClick={togglePin}
          className={`p-1 rounded-md transition-colors ${
            isOnTop
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title={isOnTop ? '取消置顶' : '窗口置顶'}
        >
          {isOnTop
            ? <Pin className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            : <PinOff className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          }
        </button>

        {/* Stats button (hidden in compact) */}
        {!isCompact && (
          <button
            onClick={onOpenStats}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            title="使用统计"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        )}

        {/* Settings button (hidden in compact) */}
        {!isCompact && (
          <button
            onClick={onOpenSettings}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
