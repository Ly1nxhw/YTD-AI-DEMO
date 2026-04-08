import { useState, useEffect } from 'react'
import { FileText, Check } from 'lucide-react'
import type { TemplateVariable } from '@/lib/variables'
import { extractVariables, fillVariables } from '@/lib/variables'

interface VariableFillPanelProps {
  /** The reply text that may contain {{变量}} */
  replyText: string
  /** Callback when user confirms variable replacement */
  onFill: (filledText: string) => void
  /** Whether in compact mode */
  isCompact?: boolean
}

export default function VariableFillPanel({ replyText, onFill, isCompact = false }: VariableFillPanelProps) {
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    const vars = extractVariables(replyText)
    setVariables(vars)
    setFilled(false)
  }, [replyText])

  // Don't render anything if no variables detected
  if (variables.length === 0) return null

  const updateValue = (index: number, value: string) => {
    setVariables(prev => prev.map((v, i) => i === index ? { ...v, value } : v))
  }

  const handleFill = () => {
    const result = fillVariables(replyText, variables)
    onFill(result)
    setFilled(true)
  }

  const allFilled = variables.every(v => v.value.trim() !== '')

  return (
    <div className={`border rounded-lg overflow-hidden ${filled ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className={`flex items-center gap-1.5 border-b ${filled ? 'border-green-200 bg-green-100' : 'border-amber-200 bg-amber-100'} ${isCompact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
        <FileText className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${filled ? 'text-green-600' : 'text-amber-600'}`} />
        <span className={`font-medium ${isCompact ? 'text-[10px]' : 'text-[11px]'} ${filled ? 'text-green-700' : 'text-amber-700'}`}>
          {filled ? '变量已填充' : `检测到 ${variables.length} 个待填变量`}
        </span>
      </div>

      {!filled && (
        <div className={`${isCompact ? 'p-2 space-y-1.5' : 'p-3 space-y-2'}`}>
          {variables.map((v, idx) => (
            <div key={v.raw} className="flex items-center gap-2">
              <code className={`shrink-0 px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono ${isCompact ? 'text-[10px]' : 'text-xs'} text-amber-700`}>
                {v.raw}
              </code>
              <input
                type="text"
                value={v.value}
                onChange={e => updateValue(idx, e.target.value)}
                placeholder={`输入${v.name}...`}
                className={`flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}
              />
            </div>
          ))}
          <button
            onClick={handleFill}
            disabled={!allFilled}
            className={`w-full flex items-center justify-center gap-1 rounded font-medium transition-colors ${
              isCompact ? 'py-1 text-[10px]' : 'py-1.5 text-xs'
            } ${
              allFilled
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Check className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            替换变量
          </button>
        </div>
      )}
    </div>
  )
}
