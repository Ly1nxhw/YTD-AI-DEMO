import { useState } from 'react'
import { X, CheckCircle, Loader2, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { testConnection } from '@/lib/llm-adapter'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, updateProvider, switchProvider, addProvider, removeProvider, resetPrompts } = useSettingsStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'llm' | 'prompts'>('llm')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')

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
                  placeholder="https://integrate.api.nvidia.com/v1"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">API Key</label>
                <input
                  type="password"
                  value={settings.llmProvider.apiKey}
                  onChange={e => updateProvider({ apiKey: e.target.value })}
                  placeholder="nvapi-... / sk-..."
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">模型</label>
                <input
                  value={settings.llmProvider.model}
                  onChange={e => updateProvider({ model: e.target.value })}
                  placeholder="meta/llama-3.3-70b-instruct"
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
