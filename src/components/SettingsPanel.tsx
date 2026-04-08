import { useState } from 'react'
import { X, CheckCircle, Loader2, RotateCcw } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { testConnection } from '@/lib/llm-adapter'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, updateProvider, resetPrompts } = useSettingsStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'llm' | 'prompts'>('llm')

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(settings.llmProvider)
    setTestResult(result)
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">服务商名称</label>
              <input
                value={settings.llmProvider.name}
                onChange={e => updateProvider({ name: e.target.value })}
                placeholder="DeepSeek / OpenAI / Ollama"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API 地址</label>
              <input
                value={settings.llmProvider.apiUrl}
                onChange={e => updateProvider({ apiUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                OpenAI: https://api.openai.com/v1 | Ollama: http://localhost:11434/v1
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <input
                type="password"
                value={settings.llmProvider.apiKey}
                onChange={e => updateProvider({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">默认模型</label>
              <input
                value={settings.llmProvider.model}
                onChange={e => updateProvider({ model: e.target.value })}
                placeholder="deepseek-chat"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Step 1 模型（理解层）</label>
                <input
                  value={settings.step1Model}
                  onChange={e => updateSettings({ step1Model: e.target.value })}
                  placeholder="留空使用默认模型"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Step 2 模型（生成层）</label>
                <input
                  value={settings.step2Model}
                  onChange={e => updateSettings({ step2Model: e.target.value })}
                  placeholder="留空使用默认模型"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">温度 (Temperature)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={settings.llmProvider.temperature ?? 0.3}
                  onChange={e => updateProvider({ temperature: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">最大 Tokens</label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  max="8000"
                  value={settings.llmProvider.maxTokens ?? 2000}
                  onChange={e => updateProvider({ maxTokens: parseInt(e.target.value) })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>

            <div>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {testing ? '测试中...' : '测试连接'}
              </button>
              {testResult !== null && (
                <div className={`mt-2 text-xs flex items-center gap-1 ${testResult ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                  {testResult ? '连接成功' : '连接失败，请检查配置'}
                </div>
              )}
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
