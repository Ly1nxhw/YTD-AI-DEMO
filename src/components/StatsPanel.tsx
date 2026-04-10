import { useState, useEffect } from 'react'
import { BarChart3, X } from 'lucide-react'
import { getDailyStats, getWeekStats, type DailyStats } from '@/agent/stats-tracker'

interface StatsPanelProps {
  onClose: () => void
}

export default function StatsPanel({ onClose }: StatsPanelProps) {
  const [today, setToday] = useState<DailyStats | null>(null)
  const [week, setWeek] = useState<DailyStats[]>([])

  useEffect(() => {
    setToday(getDailyStats())
    setWeek(getWeekStats())
  }, [])

  const weekTotal = week.reduce((s, d) => s + d.total, 0)
  const weekMatched = week.reduce((s, d) => s + d.matchedCount, 0)
  const weekEdited = week.reduce((s, d) => s + d.editedCount, 0)

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          使用统计
        </h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Today */}
        <div>
          <h3 className="text-xs font-semibold text-gray-700 mb-2">今日统计</h3>
          {today && today.total > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="处理总数" value={today.total} color="blue" />
              <StatCard label="话术匹配" value={today.matchedCount} sub={`${today.total ? Math.round(today.matchedCount / today.total * 100) : 0}%`} color="green" />
              <StatCard label="未匹配" value={today.unmatchedCount} color="amber" />
              <StatCard label="已修改" value={today.editedCount} color="purple" />
            </div>
          ) : (
            <p className="text-xs text-gray-400">今天还没有处理记录</p>
          )}

          {today && today.total > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-medium text-gray-500">分流决策</span>
                <div className="mt-1 flex gap-1.5">
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">
                    AUTO {today.autoCount}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-orange-100 text-orange-700">
                    HUMAN {today.humanCount}
                  </span>
                </div>
              </div>
              {today.topIntents.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-gray-500">高频意图</span>
                  <div className="mt-1 space-y-0.5">
                    {today.topIntents.slice(0, 3).map((t, i) => (
                      <div key={i} className="text-[10px] text-gray-600 flex justify-between">
                        <span className="truncate flex-1">{t.intent}</span>
                        <span className="text-gray-400 ml-1">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {today && today.newScriptsCount > 0 && (
            <div className="mt-2 text-[10px] text-green-600">
              ✨ 今日新增 {today.newScriptsCount} 条话术
            </div>
          )}
        </div>

        {/* Week bar chart */}
        {week.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              近7日趋势 <span className="font-normal text-gray-400">（共 {weekTotal} 条）</span>
            </h3>
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (6 - i))
                const dateStr = d.toISOString().slice(0, 10)
                const dayStats = week.find(w => w.date === dateStr)
                const count = dayStats?.total || 0
                const maxCount = Math.max(...week.map(w => w.total), 1)
                const height = count > 0 ? Math.max(8, (count / maxCount) * 64) : 4

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    {count > 0 && (
                      <span className="text-[9px] text-gray-500">{count}</span>
                    )}
                    <div
                      className={`w-full rounded-t transition-all ${
                        count > 0 ? 'bg-blue-400' : 'bg-gray-200'
                      }`}
                      style={{ height: `${height}px` }}
                    />
                    <span className="text-[9px] text-gray-400">
                      {d.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 bg-gray-50 rounded">
                <div className="text-xs font-semibold text-gray-700">{weekTotal}</div>
                <div className="text-[9px] text-gray-400">总处理</div>
              </div>
              <div className="p-1.5 bg-gray-50 rounded">
                <div className="text-xs font-semibold text-green-600">
                  {weekTotal ? Math.round(weekMatched / weekTotal * 100) : 0}%
                </div>
                <div className="text-[9px] text-gray-400">匹配率</div>
              </div>
              <div className="p-1.5 bg-gray-50 rounded">
                <div className="text-xs font-semibold text-purple-600">
                  {weekTotal ? Math.round(weekEdited / weekTotal * 100) : 0}%
                </div>
                <div className="text-[9px] text-gray-400">修改率</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: {
  label: string
  value: number
  sub?: string
  color: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
  }

  return (
    <div className={`p-2 rounded-lg text-center ${colors[color]}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-80">{label}</div>
      {sub && <div className="text-[9px] opacity-60">{sub}</div>}
    </div>
  )
}
