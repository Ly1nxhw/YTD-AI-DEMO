import { type ReactNode, useMemo, useState } from 'react'
import { Sparkles, Loader2, Check, Save, X, Wand2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { generateInitialScripts } from '@/lib/llm-adapter'
import type { GeneratedKnowledgeScript, WorkspaceInitProfile } from '@/types'

interface WorkspaceInitializerProps {
  onClose?: () => void
}

const DEFAULT_PROFILE: WorkspaceInitProfile = {
  brandName: '',
  productDomain: '',
  productSummary: '',
  salesChannel: 'Amazon',
  targetMarkets: ['德国', '法国'],
  languages: ['de', 'fr', 'en'],
  fulfillmentMode: 'FBA',
  supportPolicies: '优先了解问题原因，先尝试提供排查建议和换新/补发方案，再根据情况处理退款或退货。',
  forbiddenCommitments: '不要承诺超出平台规则的赔偿，不要擅自承诺现金补偿，不要承诺无法确认的送达时间。',
  toneStyle: '专业、友好、简洁，有同理心',
  seedScenarios: ['物流延迟', '产品损坏', '缺件补发', '退款挽留', '使用指导'],
}

const SCENARIO_SUGGESTIONS = [
  '物流延迟',
  '包裹丢失',
  '产品损坏',
  '无法使用',
  '缺件补发',
  '退款挽留',
  '退货流程',
  '换新建议',
  '配件咨询',
  '安装指导',
]

export default function WorkspaceInitializer({ onClose }: WorkspaceInitializerProps) {
  const settings = useSettingsStore(s => s.settings)
  const addEntries = useKnowledgeStore(s => s.addEntries)
  const knowledgeBase = useKnowledgeStore(s => s.knowledgeBase)

  const [profile, setProfile] = useState<WorkspaceInitProfile>(DEFAULT_PROFILE)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedKnowledgeScript[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')

  const hasProvider = !!settings.llmProvider.apiUrl && !!settings.llmProvider.model
  const canGenerate = hasProvider && !!profile.productDomain.trim() && !!profile.productSummary.trim()
  const existingCount = knowledgeBase?.entries.filter(entry => !entry.deleted).length ?? 0

  const selectedCount = selected.size
  const helperText = useMemo(() => {
    if (!hasProvider) return '请先在设置中配置 LLM 接口地址、模型和密钥。'
    if (!profile.productDomain.trim()) return '请至少填写产品领域。'
    if (!profile.productSummary.trim()) return '请至少填写产品概述。'
    return '将生成第一版工作区话术库草稿，生成后可逐条编辑和筛选。'
  }, [hasProvider, profile.productDomain, profile.productSummary])

  const updateProfile = <K extends keyof WorkspaceInitProfile>(key: K, value: WorkspaceInitProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }))
  }

  const toggleScenario = (scenario: string) => {
    const next = new Set(profile.seedScenarios)
    if (next.has(scenario)) next.delete(scenario)
    else next.add(scenario)
    updateProfile('seedScenarios', Array.from(next))
  }

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError('')
    setSavedCount(0)
    try {
      const scripts = await generateInitialScripts(
        settings.llmProvider,
        profile,
        settings.step1Model || undefined
      )
      if (scripts.length === 0) {
        setError('未生成有效话术，请补充产品信息或调整 LLM 配置后重试。')
        setGenerated([])
        setSelected(new Set())
        return
      }
      setGenerated(scripts)
      setSelected(new Set(scripts.map((_, index) => index)))
    } catch (err: any) {
      setError(err.message || '初始化生成失败，请检查 LLM 配置。')
    } finally {
      setGenerating(false)
    }
  }

  const toggleSelect = (index: number) => {
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === generated.length) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(generated.map((_, index) => index)))
  }

  const updateGenerated = (index: number, field: keyof GeneratedKnowledgeScript, value: string) => {
    setGenerated(prev => prev.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      if (field === 'keywords') {
        return {
          ...item,
          keywords: value.split(/[,，、\s]+/).filter(Boolean),
        }
      }
      return { ...item, [field]: value }
    }))
  }

  const handleSave = async () => {
    const selectedScripts = generated.filter((_, index) => selected.has(index))
    if (selectedScripts.length === 0) return

    setSaving(true)
    try {
      await addEntries(selectedScripts.map(script => ({
        title: script.title,
        category: script.category,
        keywords: script.keywords,
        content: script.content,
        scenario: script.scenario || script.category,
      })))
      setSavedCount(selectedScripts.length)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Wand2 className="w-4 h-4 text-indigo-600" />
          工作区初始化
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-100 bg-indigo-50/50">
          <div className="text-xs font-medium text-indigo-700">初始化说明</div>
          <p className="mt-1 text-[11px] leading-5 text-gray-600">
            为当前工作区生成一套首批可用的话术库草稿。适合没有现成知识库、但已经配置好 LLM 的工作区。
            当前工作区已有 {existingCount} 条有效话术。
          </p>
        </div>

        <div className="p-4 border-b border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="品牌名称">
              <input
                value={profile.brandName}
                onChange={e => updateProfile('brandName', e.target.value)}
                placeholder="例如：AeroHome"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </Field>
            <Field label="产品领域">
              <input
                value={profile.productDomain}
                onChange={e => updateProfile('productDomain', e.target.value)}
                placeholder="例如：宠物清洁设备 / 户外工具 / 小家电"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </Field>
          </div>

          <Field label="产品概述">
            <textarea
              value={profile.productSummary}
              onChange={e => updateProfile('productSummary', e.target.value)}
              rows={3}
              placeholder="描述代表产品、核心卖点、典型故障、配件或耗材信息。"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="销售渠道">
              <input
                value={profile.salesChannel}
                onChange={e => updateProfile('salesChannel', e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </Field>
            <Field label="履约方式">
              <input
                value={profile.fulfillmentMode}
                onChange={e => updateProfile('fulfillmentMode', e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="目标市场">
              <input
                value={profile.targetMarkets.join('、')}
                onChange={e => updateProfile('targetMarkets', e.target.value.split(/[、,，\s]+/).filter(Boolean))}
                placeholder="德国、法国、美国"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </Field>
            <Field label="服务语言">
              <input
                value={profile.languages.join('、')}
                onChange={e => updateProfile('languages', e.target.value.split(/[、,，\s]+/).filter(Boolean))}
                placeholder="de、fr、en"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </Field>
          </div>

          <Field label="售后策略">
            <textarea
              value={profile.supportPolicies}
              onChange={e => updateProfile('supportPolicies', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </Field>

          <Field label="禁止承诺项">
            <textarea
              value={profile.forbiddenCommitments}
              onChange={e => updateProfile('forbiddenCommitments', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </Field>

          <Field label="客服语气">
            <input
              value={profile.toneStyle}
              onChange={e => updateProfile('toneStyle', e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </Field>

          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">优先场景</div>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_SUGGESTIONS.map(scenario => (
                <button
                  key={scenario}
                  onClick={() => toggleScenario(scenario)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    profile.seedScenarios.includes(scenario)
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {scenario}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">{helperText}</span>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? '生成中...' : '生成首批话术'}
            </button>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {generated.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-gray-700">审核生成结果（共 {generated.length} 条）</div>
              <button onClick={toggleAll} className="text-[10px] text-indigo-600 hover:underline">
                {selectedCount === generated.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="space-y-2.5">
              {generated.map((script, index) => (
                <div
                  key={`${script.title}-${index}`}
                  className={`rounded-lg border overflow-hidden ${
                    selected.has(index) ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <button
                      onClick={() => toggleSelect(index)}
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selected.has(index) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'
                      }`}
                    >
                      {selected.has(index) && <Check className="w-3 h-3" />}
                    </button>
                    <input
                      value={script.title}
                      onChange={e => updateGenerated(index, 'title', e.target.value)}
                      className="flex-1 bg-transparent text-xs font-medium text-gray-800 focus:outline-none"
                    />
                    <input
                      value={script.category}
                      onChange={e => updateGenerated(index, 'category', e.target.value)}
                      className="w-28 rounded bg-white px-2 py-1 text-[11px] text-gray-600 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>

                  <div className="px-3 py-2 space-y-2">
                    <div>
                      <div className="text-[10px] text-gray-400">适用场景</div>
                      <input
                        value={script.scenario}
                        onChange={e => updateGenerated(index, 'scenario', e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">客户示例</div>
                      <input
                        value={script.customerExample}
                        onChange={e => updateGenerated(index, 'customerExample', e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">话术模板</div>
                      <textarea
                        value={script.content}
                        onChange={e => updateGenerated(index, 'content', e.target.value)}
                        rows={4}
                        className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-[11px] resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">关键词</div>
                      <input
                        value={script.keywords.join('、')}
                        onChange={e => updateGenerated(index, 'keywords', e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              {savedCount > 0 ? (
                <div className="text-xs text-green-600">已保存 {savedCount} 条初始化话术到知识库</div>
              ) : (
                <div className="text-[10px] text-gray-400">已选 {selectedCount} / {generated.length} 条</div>
              )}
              <button
                onClick={handleSave}
                disabled={selectedCount === 0 || saving || savedCount > 0}
                className="px-4 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? '保存中...' : savedCount > 0 ? '已保存' : '批量写入工作区'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  )
}
