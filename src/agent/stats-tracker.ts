/**
 * Stats Tracker — 个人使用统计
 *
 * 记录每次生成的关键信息，按天聚合统计
 */

export interface SessionRecord {
  timestamp: string
  intent: string
  language: string
  decision: 'AUTO' | 'HUMAN'
  matched: boolean        // had matching scripts
  edited: boolean         // user edited the reply
  savedAsScript: boolean  // user saved a new script
}

export interface DailyStats {
  date: string
  total: number
  autoCount: number
  humanCount: number
  matchedCount: number
  unmatchedCount: number
  editedCount: number
  newScriptsCount: number
  topIntents: { intent: string; count: number }[]
  topLanguages: { lang: string; count: number }[]
}

const STORAGE_KEY = 'stats-tracker-records'

function loadRecords(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecords(records: SessionRecord[]) {
  // Keep last 90 days of records
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString()
  const filtered = records.filter(r => r.timestamp >= cutoffStr)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

/**
 * Record a completed generation session
 */
export function recordSession(record: Omit<SessionRecord, 'timestamp'>) {
  const records = loadRecords()
  records.push({
    ...record,
    timestamp: new Date().toISOString(),
  })
  saveRecords(records)
}

/**
 * Mark the last session as edited
 */
export function markLastSessionEdited() {
  const records = loadRecords()
  if (records.length > 0) {
    records[records.length - 1].edited = true
    saveRecords(records)
  }
}

/**
 * Mark the last session as saved-as-script
 */
export function markLastSessionSavedScript() {
  const records = loadRecords()
  if (records.length > 0) {
    records[records.length - 1].savedAsScript = true
    saveRecords(records)
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Get stats for a specific date (default: today)
 */
export function getDailyStats(date?: string): DailyStats {
  const d = date || todayStr()
  const records = loadRecords().filter(r => r.timestamp.startsWith(d))

  const intentMap = new Map<string, number>()
  const langMap = new Map<string, number>()

  for (const r of records) {
    intentMap.set(r.intent, (intentMap.get(r.intent) || 0) + 1)
    langMap.set(r.language, (langMap.get(r.language) || 0) + 1)
  }

  return {
    date: d,
    total: records.length,
    autoCount: records.filter(r => r.decision === 'AUTO').length,
    humanCount: records.filter(r => r.decision === 'HUMAN').length,
    matchedCount: records.filter(r => r.matched).length,
    unmatchedCount: records.filter(r => !r.matched).length,
    editedCount: records.filter(r => r.edited).length,
    newScriptsCount: records.filter(r => r.savedAsScript).length,
    topIntents: Array.from(intentMap.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topLanguages: Array.from(langMap.entries())
      .map(([lang, count]) => ({ lang, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * Get stats for last N days
 */
export function getWeekStats(): DailyStats[] {
  const stats: DailyStats[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const s = getDailyStats(dateStr)
    if (s.total > 0) stats.push(s)
  }
  return stats
}
