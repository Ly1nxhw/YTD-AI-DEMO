import { useEffect, useState } from 'react'
import { X, CheckCircle, Loader2, RotateCcw, Plus, Trash2, FolderOpen, Download, Upload, Pencil } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { testConnection } from '@/lib/llm-adapter'
import type { BackupInfo, WorkspaceChangeStatus } from '@/types'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, updateProvider, switchProvider, addProvider, removeProvider, resetPrompts } = useSettingsStore()
  const loadSettings = useSettingsStore(s => s.loadSettings)
  const loadKnowledgeBase = useKnowledgeStore(s => s.loadKnowledgeBase)
  const {
    workspace,
    recent,
    createWorkspace,
    switchWorkspace,
    openWorkspaceDirectory,
    renameWorkspace,
    importWorkspaceZip,
    loading: workspaceLoading,
  } = useWorkspaceStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'workspace' | 'llm' | 'prompts'>('workspace')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [renameWorkspaceName, setRenameWorkspaceName] = useState('')
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [changeStatus, setChangeStatus] = useState<WorkspaceChangeStatus | null>(null)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(settings.llmProvider)
      setTestResult(result)
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || String(err) })
    }
    setTesting(false)
  }

  const refreshWorkspaceContext = async () => {
    await Promise.all([
      loadSettings(),
      loadKnowledgeBase(),
    ])
    await window.electronAPI.acknowledgeWorkspaceState()
  }

  const refreshWorkspaceMaintenance = async () => {
    if (!workspace) return
    const [backupList, status] = await Promise.all([
      window.electronAPI.listWorkspaceBackups(),
      window.electronAPI.checkWorkspaceExternalChanges(),
    ])
    setBackups(backupList)
    setChangeStatus(status)
  }

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim()
    if (!name) return
    const ok = await createWorkspace({ name, chooseLocation: true })
    if (!ok) return
    await refreshWorkspaceContext()
    setNewWorkspaceName('')
  }

  const handleSwitchWorkspace = async (workspacePath: string) => {
    if (workspace?.path === workspacePath) return
    await switchWorkspace(workspacePath)
    await refreshWorkspaceContext()
  }

  const handleOpenWorkspaceDirectory = async () => {
    const ok = await openWorkspaceDirectory()
    if (!ok) return
    await refreshWorkspaceContext()
    await refreshWorkspaceMaintenance()
    setMaintenanceMessage('已打开工作区目录')
  }

  const handleRenameWorkspace = async () => {
    const targetName = renameWorkspaceName.trim()
    if (!targetName) return
    const ok = await renameWorkspace(targetName)
    if (!ok) {
      setMaintenanceMessage('工作区重命名失败')
      return
    }
    await refreshWorkspaceContext()
    await refreshWorkspaceMaintenance()
    setRenameWorkspaceName('')
    setMaintenanceMessage('工作区已重命名')
  }

  const handleExportWorkspace = async () => {
    setMaintenanceLoading(true)
    try {
      const exported = await window.electronAPI.exportWorkspaceZip()
      setMaintenanceMessage(exported ? `已导出到 ${exported}` : '已取消导出')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleImportWorkspace = async () => {
    const ok = await importWorkspaceZip()
    if (!ok) return
    await refreshWorkspaceContext()
    await refreshWorkspaceMaintenance()
    setMaintenanceMessage('工作区 ZIP 已导入')
  }

  const handleManualBackup = async () => {
    setMaintenanceLoading(true)
    try {
      await window.electronAPI.createWorkspaceBackup('manual')
      await refreshWorkspaceMaintenance()
      setMaintenanceMessage('已创建手动备份')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    const confirmed = window.confirm('恢复备份会覆盖当前工作区文件，继续吗？')
    if (!confirmed) return

    setMaintenanceLoading(true)
    try {
      const ok = await window.electronAPI.restoreWorkspaceBackup(backupId)
      if (ok) {
        await refreshWorkspaceContext()
        await refreshWorkspaceMaintenance()
        setMaintenanceMessage('备份已恢复')
      } else {
        setMaintenanceMessage('恢复备份失败')
      }
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleCheckExternalChanges = async () => {
    setMaintenanceLoading(true)
    try {
      const status = await window.electronAPI.checkWorkspaceExternalChanges()
      setChangeStatus(status)
      setMaintenanceMessage(status.hasExternalChanges ? '检测到工作区文件外部修改' : '未发现外部修改')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleReloadWorkspace = async () => {
    setMaintenanceLoading(true)
    try {
      await refreshWorkspaceContext()
      await refreshWorkspaceMaintenance()
      setMaintenanceMessage('工作区已重新加载')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  useEffect(() => {
    void refreshWorkspaceMaintenance()
  }, [workspace?.path])

  useEffect(() => {
    setRenameWorkspaceName(workspace?.name ?? '')
  }, [workspace?.name])

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">设置</h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'workspace'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          工作区
        </button>
        <button
          onClick={() => setActiveTab('llm')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'llm'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          LLM 配置
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'prompts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Prompt 模板
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {workspace && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-[11px] font-medium text-gray-600">当前工作区</div>
            <div className="mt-1 text-xs text-gray-800">{workspace.name}</div>
            <div className="mt-0.5 break-all text-[10px] text-gray-500">{workspace.path}</div>
            <div className="mt-3 flex gap-2">
              <input
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    void handleCreateWorkspace()
                  }
                }}
                placeholder="新工作区名称"
                className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => void handleCreateWorkspace()}
                disabled={workspaceLoading || !newWorkspaceName.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                新建
              </button>
              <button
                onClick={() => void handleOpenWorkspaceDirectory()}
                disabled={workspaceLoading}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                title="打开已有工作区目录"
              >
                <FolderOpen className="inline h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={renameWorkspaceName}
                onChange={e => setRenameWorkspaceName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    void handleRenameWorkspace()
                  }
                }}
                placeholder="重命名当前工作区"
                className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => void handleRenameWorkspace()}
                disabled={workspaceLoading || !renameWorkspaceName.trim()}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
              >
                <Pencil className="inline h-3.5 w-3.5" />
              </button>
            </div>
            {recent.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-medium text-gray-600">最近工作区</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {recent.map(item => (
                    <button
                      key={item.path}
                      onClick={() => void handleSwitchWorkspace(item.path)}
                      disabled={workspaceLoading}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        item.path === workspace.path
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'workspace' && workspace && (
          <div className="max-w-2xl space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-700">工作区维护</div>
                  <div className="mt-1 text-[11px] text-gray-500">检查外部改动，或在关键节点前创建快照。</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleImportWorkspace()}
                    disabled={workspaceLoading}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                  >
                    <Upload className="mr-1 inline h-3.5 w-3.5" />
                    导入 ZIP
                  </button>
                  <button
                    onClick={() => void handleExportWorkspace()}
                    disabled={maintenanceLoading}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                  >
                    <Download className="mr-1 inline h-3.5 w-3.5" />
                    导出 ZIP
                  </button>
                  <button
                    onClick={() => void handleCheckExternalChanges()}
                    disabled={maintenanceLoading}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                  >
                    检查变更
                  </button>
                  <button
                    onClick={() => void handleManualBackup()}
                    disabled={maintenanceLoading}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    立即备份
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="text-[11px] font-medium text-gray-600">外部修改状态</div>
                <div className={`mt-1 text-xs ${changeStatus?.hasExternalChanges ? 'text-amber-600' : 'text-green-600'}`}>
                  {changeStatus?.hasExternalChanges ? '检测到外部修改' : '当前无外部修改'}
                </div>
                {changeStatus?.changedFiles && changeStatus.changedFiles.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] text-gray-500">变更文件</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {changeStatus.changedFiles.slice(0, 8).map(file => (
                        <span key={file} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          {file}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => void handleReloadWorkspace()}
                      disabled={maintenanceLoading}
                      className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      重新加载工作区
                    </button>
                  </div>
                )}
              </div>

              {maintenanceMessage && (
                <div className="mt-3 text-xs text-gray-500">{maintenanceMessage}</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-700">最近备份</div>
                  <div className="mt-1 text-[11px] text-gray-500">自动备份会在修改设置、知识库和 memory 时触发，最多保留 20 份。</div>
                </div>
                <span className="text-[11px] text-gray-400">{backups.length} 份</span>
              </div>

              <div className="mt-3 space-y-2">
                {backups.length === 0 && (
                  <div className="text-xs text-gray-400">还没有备份</div>
                )}
                {backups.map(backup => (
                  <div key={backup.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-700">{new Date(backup.createdAt).toLocaleString()}</div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {backup.reason === 'manual' ? '手动备份' :
                         backup.reason === 'settings' ? '设置变更' :
                         backup.reason === 'knowledge-base' ? '知识库变更' : 'Memory 变更'}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleRestoreBackup(backup.id)}
                      disabled={maintenanceLoading}
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                    >
                      恢复
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'llm' && (
          <div className="space-y-4 max-w-lg">
            {/* Provider selector pills */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">模型服务商</label>
              <div className="flex flex-wrap gap-1.5">
                {settings.llmProviders.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { switchProvider(p.id); setTestResult(null) }}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                      settings.activeProviderId === p.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {p.name}
                    {p.apiKey ? '' : ' ⚠️'}
                  </button>
                ))}
                {!showAddForm ? (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-2 py-1.5 text-xs rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-blue-300 hover:text-blue-500"
                  >
                    <Plus className="w-3 h-3 inline" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      value={newProviderName}
                      onChange={e => setNewProviderName(e.target.value)}
                      placeholder="名称"
                      className="px-2 py-1 text-xs border rounded-full w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newProviderName.trim()) {
                          addProvider({
                            id: `custom-${Date.now()}`,
                            name: newProviderName.trim(),
                            type: 'openai-compatible',
                            apiUrl: '',
                            apiKey: '',
                            model: '',
                            maxTokens: 2000,
                            temperature: 0.3,
                          })
                          setNewProviderName('')
                          setShowAddForm(false)
                        }
                        if (e.key === 'Escape') setShowAddForm(false)
                      }}
                    />
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Active provider config */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{settings.llmProvider.name}</span>
                {settings.llmProviders.length > 1 && (
                  <button
                    onClick={() => removeProvider(settings.llmProvider.id)}
                    className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    删除
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">API 地址</label>
                <input
                  value={settings.llmProvider.apiUrl}
                  onChange={e => updateProvider({ apiUrl: e.target.value })}
                  placeholder="输入服务接口地址"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">API Key</label>
                <input
                  type="password"
                  value={settings.llmProvider.apiKey}
                  onChange={e => updateProvider({ apiKey: e.target.value })}
                  placeholder="输入访问密钥"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">模型</label>
                <input
                  value={settings.llmProvider.model}
                  onChange={e => updateProvider({ model: e.target.value })}
                  placeholder="输入模型标识"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">温度</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={settings.llmProvider.temperature ?? 0.3}
                    onChange={e => updateProvider({ temperature: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">最大 Tokens</label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    max="8000"
                    value={settings.llmProvider.maxTokens ?? 2000}
                    onChange={e => updateProvider({ maxTokens: parseInt(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {testing ? '测试中...' : '测试连接'}
                </button>
                {testResult !== null && (
                  <div className={`mt-1.5 text-xs ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                    <div className="flex items-center gap-1">
                      {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                      {testResult.ok ? '连接成功' : '连接失败'}
                    </div>
                    {testResult.error && (
                      <p className="mt-1 text-[10px] text-red-500 bg-red-50 p-1.5 rounded break-all max-h-20 overflow-y-auto">
                        {testResult.error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step model overrides */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">分流模型（Step 0）</label>
                <input
                  value={settings.step1Model}
                  onChange={e => updateSettings({ step1Model: e.target.value })}
                  placeholder="留空使用默认模型"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">生成模型（Step 2）</label>
                <input
                  value={settings.step2Model}
                  onChange={e => updateSettings({ step2Model: e.target.value })}
                  placeholder="留空使用默认模型"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Prompt 模板</span>
              <button
                onClick={resetPrompts}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
              >
                <RotateCcw className="w-3 h-3" />
                恢复默认
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Prompt A — 理解层 + 话术匹配（Step 1）
              </label>
              <p className="text-[10px] text-gray-400 mb-1">
                可用变量: {'{script_catalog}'}（运行时自动替换为话术库标题列表）
              </p>
              <textarea
                value={settings.promptA}
                onChange={e => updateSettings({ promptA: e.target.value })}
                rows={14}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Prompt B — 生成层（Step 2）
              </label>
              <p className="text-[10px] text-gray-400 mb-1">
                可用变量: {'{customer_message}'}, {'{chinese_translation}'}, {'{intent}'}, {'{matched_scripts}'}, {'{target_language}'}, {'{has_match}'}
              </p>
              <textarea
                value={settings.promptB}
                onChange={e => updateSettings({ promptB: e.target.value })}
                rows={14}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
