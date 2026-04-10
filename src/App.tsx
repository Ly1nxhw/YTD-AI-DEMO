import { useEffect, useState } from 'react'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useGenerationStore } from '@/stores/generation-store'
import Sidebar from '@/components/Sidebar'
import MainPanel from '@/components/MainPanel'
import SettingsPanel from '@/components/SettingsPanel'
import StatusBar from '@/components/StatusBar'
import TitleBar from '@/components/TitleBar'
import StatsPanel from '@/components/StatsPanel'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const loadKnowledgeBase = useKnowledgeStore(s => s.loadKnowledgeBase)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  useEffect(() => {
    loadKnowledgeBase()
    loadSettings()
    window.electronAPI?.getCompactMode().then(setIsCompact)

    // Register global shortcut (Ctrl+Shift+V to summon window)
    window.electronAPI?.registerGlobalShortcut('CommandOrControl+Shift+Q')

    // Listen for clipboard text from main process
    const cleanup = window.electronAPI?.onClipboardText((text: string) => {
      const store = useGenerationStore.getState()
      if (store.status === 'idle' || store.status === 'done' || store.status === 'error') {
        store.setCustomerMessage(text)
      }
    })

    return () => { cleanup?.() }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-50 select-none">
      <TitleBar
        onOpenSettings={() => { setShowSettings(true); setShowStats(false) }}
        onOpenStats={() => { setShowStats(true); setShowSettings(false) }}
        isCompact={isCompact}
        onCompactChange={setIsCompact}
      />

      <div className="flex flex-1 overflow-hidden">
        {!isCompact && <Sidebar />}
        {showSettings && !isCompact ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : showStats && !isCompact ? (
          <StatsPanel onClose={() => setShowStats(false)} />
        ) : (
          <MainPanel isCompact={isCompact} />
        )}
      </div>

      {!isCompact && <StatusBar />}
    </div>
  )
}
