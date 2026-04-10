/**
 * Gap Tracker — 记录话术库未覆盖的场景
 *
 * 每次 unmatched 时记录：意图、语言、客户消息摘要
 * 定期提示用户哪些场景需要补充话术
 */

interface GapEntry {
  timestamp: string
  intent: string
  language: string
  messageSummary: string  // first 80 chars
  saved: boolean          // whether user saved a new script for it
}

const STORAGE_KEY = 'gap-tracker-entries'

function loadGaps(): GapEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveGaps(gaps: GapEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gaps))
}

/**
 * Record an unmatched scenario
 */
export function recordGap(intent: string, language: string, customerMessage: string) {
  const gaps = loadGaps()
  gaps.push({
    timestamp: new Date().toISOString(),
    intent: intent || '未知意图',
    language: language || '??',
    messageSummary: customerMessage.slice(0, 80),
    saved: false,
  })
  // Keep last 200 entries
  if (gaps.length > 200) gaps.splice(0, gaps.length - 200)
  saveGaps(gaps)
}

/**
 * Mark a gap as resolved (user saved a script for it)
 */
export function resolveGap(intent: string) {
  const gaps = loadGaps()
  for (const g of gaps) {
    if (!g.saved && g.intent === intent) {
      g.saved = true
    }
  }
  saveGaps(gaps)
}

/**
 * Get unresolved gaps grouped by intent
 */
export function getGapSummary(): { intent: string; count: number; lastSeen: string }[] {
  const gaps = loadGaps().filter(g => !g.saved)
  const grouped = new Map<string, { count: number; lastSeen: string }>()

  for (const g of gaps) {
    const existing = grouped.get(g.intent)
    if (existing) {
      existing.count++
      if (g.timestamp > existing.lastSeen) existing.lastSeen = g.timestamp
    } else {
      grouped.set(g.intent, { count: 1, lastSeen: g.timestamp })
    }
  }

  return Array.from(grouped.entries())
    .map(([intent, data]) => ({ intent, ...data }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get total unresolved gap count
 */
export function getUnresolvedGapCount(): number {
  return loadGaps().filter(g => !g.saved).length
}

/**
 * Clear all gaps
 */
export function clearGaps() {
  saveGaps([])
}
