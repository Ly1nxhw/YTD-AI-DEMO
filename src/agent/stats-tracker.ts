/**
 * Stats Tracker — 工作区级别使用统计
 */

export interface SessionRecord {
  timestamp: string
  intent: string
  language: string
  decision: 'AUTO' | 'HUMAN'
  matched: boolean
  edited: boolean
  savedAsScript: boolean
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

const LEGACY_STORAGE_KEY = 'stats-tracker-records'

let migrated = false

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

async function migrateLegacyLocalStats() {
  if (migrated) return
  migrated = true

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return

    const records = JSON.parse(raw) as SessionRecord[]
    if (!Array.isArray(records) || records.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return
    }

    const existing = await window.electronAPI.readStatsRecords()
    const seen = new Set(existing.map((record: SessionRecord) => JSON.stringify(record)))

    for (const record of records) {
      const key = JSON.stringify(record)
      if (!seen.has(key)) {
        await window.electronAPI.appendStatsRecord(record)
      }
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Ignore migration failures; new writes still go to workspace stats.
  }
}

async function loadRecords(): Promise<SessionRecord[]> {
  await migrateLegacyLocalStats()
  try {
    return await window.electronAPI.readStatsRecords() as SessionRecord[]
  } catch {
    return []
  }
}

function buildDailyStats(records: SessionRecord[], date: string): DailyStats {
  const dailyRecords = records.filter(record => record.timestamp.startsWith(date))
  const intentMap = new Map<string, number>()
  const langMap = new Map<string, number>()

  for (const record of dailyRecords) {
    intentMap.set(record.intent, (intentMap.get(record.intent) || 0) + 1)
    langMap.set(record.language, (langMap.get(record.language) || 0) + 1)
  }

  return {
    date,
    total: dailyRecords.length,
    autoCount: dailyRecords.filter(record => record.decision === 'AUTO').length,
    humanCount: dailyRecords.filter(record => record.decision === 'HUMAN').length,
    matchedCount: dailyRecords.filter(record => record.matched).length,
    unmatchedCount: dailyRecords.filter(record => !record.matched).length,
    editedCount: dailyRecords.filter(record => record.edited).length,
    newScriptsCount: dailyRecords.filter(record => record.savedAsScript).length,
    topIntents: Array.from(intentMap.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topLanguages: Array.from(langMap.entries())
      .map(([lang, count]) => ({ lang, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export async function recordSession(record: Omit<SessionRecord, 'timestamp'>) {
  await migrateLegacyLocalStats()
  await window.electronAPI.appendStatsRecord({
    ...record,
    timestamp: new Date().toISOString(),
  })
}

export async function markLastSessionEdited() {
  await migrateLegacyLocalStats()
  await window.electronAPI.updateLastStatsRecord({ edited: true })
}

export async function markLastSessionSavedScript() {
  await migrateLegacyLocalStats()
  await window.electronAPI.updateLastStatsRecord({ savedAsScript: true })
}

export async function getDailyStats(date?: string): Promise<DailyStats> {
  const targetDate = date || todayStr()
  const records = await loadRecords()
  return buildDailyStats(records, targetDate)
}

export async function getWeekStats(): Promise<DailyStats[]> {
  const records = await loadRecords()
  const stats: DailyStats[] = []

  for (let index = 0; index < 7; index += 1) {
    const date = new Date()
    date.setDate(date.getDate() - index)
    const dateStr = date.toISOString().slice(0, 10)
    const dailyStats = buildDailyStats(records, dateStr)
    if (dailyStats.total > 0) {
      stats.push(dailyStats)
    }
  }

  return stats
}
