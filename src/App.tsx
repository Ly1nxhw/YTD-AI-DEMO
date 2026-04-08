import { useEffect, useState } from 'react'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useSettingsStore } from '@/stores/settings-store'
import Sidebar from '@/components/Sidebar'
import MainPanel from '@/components/MainPanel'
import SettingsPanel from '@/components/SettingsPanel'
import StatusBar from '@/components/StatusBar'
import TitleBar from '@/components/TitleBar'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const loadKnowledgeBase = useKnowledgeStore(s => s.loadKnowledgeBase)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  useEffect(() => {
    loadKnowledgeBase()
    loadSettings()
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-50 select-none">
      <TitleBar onOpenSettings={() => setShowSettings(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : (
          <MainPanel />
        )}
      </div>

      <StatusBar />
    </div>
  )
}
