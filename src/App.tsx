import { useEffect, useState } from 'react'
import { AlertTriangle, FolderOpen, Plus, Upload } from 'lucide-react'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useGenerationStore } from '@/stores/generation-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import Sidebar from '@/components/Sidebar'
import MainPanel from '@/components/MainPanel'
import SettingsPanel from '@/components/SettingsPanel'
import StatusBar from '@/components/StatusBar'
import TitleBar from '@/components/TitleBar'
import StatsPanel from '@/components/StatsPanel'
import ConversationLearner from '@/components/ConversationLearner'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showLearner, setShowLearner] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [externalChanges, setExternalChanges] = useState<string[]>([])
  const loadKnowledgeBase = useKnowledgeStore(s => s.loadKnowledgeBase)
  const loadSettings = useSettingsStore(s => s.loadSettings)
  const loadWorkspace = useWorkspaceStore(s => s.loadWorkspace)
  const workspace = useWorkspaceStore(s => s.workspace)
  const recent = useWorkspaceStore(s => s.recent)
  const createWorkspace = useWorkspaceStore(s => s.createWorkspace)
  const switchWorkspace = useWorkspaceStore(s => s.switchWorkspace)
  const openWorkspaceDirectory = useWorkspaceStore(s => s.openWorkspaceDirectory)
  const importWorkspaceZip = useWorkspaceStore(s => s.importWorkspaceZip)
  const workspaceLoading = useWorkspaceStore(s => s.loading)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')

  useEffect(() => {
    loadWorkspace()
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
  }, [loadWorkspace])

  useEffect(() => {
    if (!workspace?.path) return
    loadKnowledgeBase()
    loadSettings()
  }, [workspace?.path, loadKnowledgeBase, loadSettings])

  useEffect(() => {
    if (!workspace?.path) return

    let active = true
    const poll = async () => {
      const status = await window.electronAPI.checkWorkspaceExternalChanges()
      if (!active) return
      setExternalChanges(status.hasExternalChanges ? status.changedFiles : [])
    }

    void poll()
    const timer = window.setInterval(() => { void poll() }, 15000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [workspace?.path])

  const reloadWorkspaceFromBanner = async () => {
    await Promise.all([
      loadWorkspace(),
      loadKnowledgeBase(),
      loadSettings(),
      window.electronAPI.acknowledgeWorkspaceState(),
    ])
    setExternalChanges([])
  }

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim()
    if (!name) return
    await createWorkspace({ name, chooseLocation: true })
    setNewWorkspaceName('')
  }

  const handleOpenWorkspaceDirectory = async () => {
    await openWorkspaceDirectory()
  }

  const handleImportWorkspace = async () => {
    await importWorkspaceZip()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 select-none">
      <TitleBar
        onOpenSettings={() => { setShowSettings(true); setShowStats(false); setShowLearner(false) }}
        isCompact={isCompact}
        onCompactChange={setIsCompact}
      />

      {externalChanges.length > 0 && !isCompact && (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>工作区文件已被外部修改</span>
            <span className="text-amber-700/80">
              {externalChanges.slice(0, 3).join(', ')}
              {externalChanges.length > 3 ? ` 等 ${externalChanges.length} 项` : ''}
            </span>
          </div>
          <button
            onClick={() => void reloadWorkspaceFromBanner()}
            className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
          >
            重新加载
          </button>
        </div>
      )}

      {!workspace ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="max-w-xl">
              <div className="text-sm font-semibold text-blue-600">工作区启动</div>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">先选择一个工作区，再进入工作台</h1>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                这里的工作区概念和 VS Code 很接近。
                工作区就是当前业务场景的完整本地容器，里面包含话术库、LLM 配置、提示词、memory、统计和备份。
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <button
                onClick={() => void handleOpenWorkspaceDirectory()}
                disabled={workspaceLoading}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
              >
                <FolderOpen className="h-5 w-5 text-blue-600" />
                <div className="mt-3 text-sm font-medium text-gray-800">打开已有工作区</div>
                <div className="mt-1 text-xs text-gray-500">像 VS Code 的“Open Folder”，直接进入现有目录。</div>
              </button>

              <button
                onClick={() => void handleImportWorkspace()}
                disabled={workspaceLoading}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
              >
                <Upload className="h-5 w-5 text-blue-600" />
                <div className="mt-3 text-sm font-medium text-gray-800">导入工作区 ZIP</div>
                <div className="mt-1 text-xs text-gray-500">从备份包或其他机器导出的工作区恢复。</div>
              </button>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <Plus className="h-5 w-5 text-blue-600" />
                <div className="mt-3 text-sm font-medium text-gray-800">新建工作区</div>
                <div className="mt-1 text-xs text-gray-500">从零开始创建一个新的业务场景容器。</div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newWorkspaceName}
                    onChange={e => setNewWorkspaceName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        void handleCreateWorkspace()
                      }
                    }}
                    placeholder="工作区名称"
                    className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => void handleCreateWorkspace()}
                    disabled={workspaceLoading || !newWorkspaceName.trim()}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>

            {recent.length > 0 && (
              <div className="mt-8">
                <div className="text-xs font-medium text-gray-600">最近工作区</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recent.map(item => (
                    <button
                      key={item.path}
                      onClick={() => void switchWorkspace(item.path)}
                      disabled={workspaceLoading}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            {!isCompact && (
              <Sidebar
                onOpenKB={() => { setShowStats(false); setShowSettings(false); setShowLearner(false) }}
                onOpenStats={() => { setShowStats(true); setShowSettings(false); setShowLearner(false) }}
                onOpenLearner={() => { setShowLearner(true); setShowSettings(false); setShowStats(false) }}
                activePanel={showStats ? 'stats' : showLearner ? 'learner' : undefined}
              />
            )}
            {showSettings && !isCompact ? (
              <SettingsPanel onClose={() => setShowSettings(false)} />
            ) : showStats && !isCompact ? (
              <StatsPanel onClose={() => setShowStats(false)} />
            ) : showLearner && !isCompact ? (
              <ConversationLearner onClose={() => setShowLearner(false)} />
            ) : (
              <MainPanel isCompact={isCompact} />
            )}
          </div>

          {!isCompact && <StatusBar />}
        </>
      )}
    </div>
  )
}
