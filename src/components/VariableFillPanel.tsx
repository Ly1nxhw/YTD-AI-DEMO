import { useState, useEffect } from 'react'
import { FileText, Check, Calendar } from 'lucide-react'
import type { TemplateVariable } from '@/lib/variables'
import { extractVariables, fillBothTexts, formatDate, formatDateChinese } from '@/lib/variables'

interface VariableFillPanelProps {
  replyText: string
  chineseText: string
  targetLang: string
  onFill: (filledReply: string, filledChinese: string) => void
  isCompact?: boolean
}

export default function VariableFillPanel({ replyText, chineseText, targetLang, onFill, isCompact = false }: VariableFillPanelProps) {
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    const vars = extractVariables(replyText, chineseText)
    setVariables(vars)
    setFilled(false)
  }, [replyText, chineseText])

  if (variables.length === 0) return null

  const updateInput = (index: number, val: string) => {
    setVariables(prev => prev.map((v, i) => i === index ? { ...v, inputValue: val } : v))
  }

  const handleFill = () => {
    const { filledReply, filledChinese } = fillBothTexts(replyText, chineseText, variables, targetLang)
    onFill(filledReply, filledChinese)
    setFilled(true)
  }

  const allFilled = variables.every(v => v.inputValue.trim() !== '')

  return (
    <div className={`border rounded-lg overflow-hidden ${filled ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className={`flex items-center gap-1.5 border-b ${filled ? 'border-green-200 bg-green-100' : 'border-amber-200 bg-amber-100'} ${isCompact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
        <FileText className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${filled ? 'text-green-600' : 'text-amber-600'}`} />
        <span className={`font-medium ${isCompact ? 'text-[10px]' : 'text-[11px]'} ${filled ? 'text-green-700' : 'text-amber-700'}`}>
          {filled ? '变量已填充' : `检测到 ${variables.length} 个待填变量`}
        </span>
      </div>

      {!filled && (
        <div className={`${isCompact ? 'p-2 space-y-2' : 'p-3 space-y-2.5'}`}>
          {variables.map((v, idx) => (
            <div key={`${v.raw}-${idx}`}>
              <div className="flex items-center gap-2">
                <code className={`shrink-0 px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono ${isCompact ? 'text-[10px]' : 'text-xs'} text-amber-700`}>
                  {v.nameChinese}
                </code>
                {v.type === 'date' ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <Calendar className={`shrink-0 text-amber-500 ${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                    <input
                      type="date"
                      value={v.inputValue}
                      onChange={e => updateInput(idx, e.target.value)}
                      className={`flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={v.inputValue}
                    onChange={e => updateInput(idx, e.target.value)}
                    placeholder={`输入${v.nameChinese}...`}
                    className={`flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                  />
                )}
              </div>
              {v.type === 'date' && v.inputValue && (
                <div className={`mt-1 flex gap-3 ${isCompact ? 'text-[9px] ml-6' : 'text-[10px] ml-8'} text-gray-500`}>
                  <span>🌐 {formatDate(v.inputValue, targetLang)}</span>
                  <span>🇨🇳 {formatDateChinese(v.inputValue)}</span>
                </div>
              )}
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
