/**
 * Memory Manager — 记忆系统的读写与容量管控
 *
 * 记忆文件层级:
 *   CONSTITUTION.md  — 🔒 只读宪法
 *   SOUL.md          — 🔄 风格人设 (可学习)
 *   SKILLS.md        — 🔄 技能经验 (可学习)
 *   SCRIPTS_FEEDBACK.md — 🔄 话术反馈
 *   HEARTBEAT.md     — 💓 心跳任务
 *   daily/YYYY-MM-DD.md — 📝 每日日志
 */

// Token limits per file (approximate, 1 token ≈ 1.5 Chinese chars ≈ 4 English chars)
const TOKEN_LIMITS: Record<string, number> = {
  'CONSTITUTION.md': Infinity,     // no limit, read-only
  'SOUL.md': 1000,
  'SKILLS.md': 3000,
  'SCRIPTS_FEEDBACK.md': 2000,
  'HEARTBEAT.md': Infinity,
  'daily': 2000,                   // per daily file
}

// Read-only files that Agent cannot modify
const READ_ONLY_FILES = new Set(['CONSTITUTION.md'])

export type MemoryFile =
  | 'CONSTITUTION.md'
  | 'SOUL.md'
  | 'SKILLS.md'
  | 'SCRIPTS_FEEDBACK.md'
  | 'HEARTBEAT.md'

export interface DailyLogEntry {
  time: string        // HH:MM
  lang: string        // language code
  intent: string      // detected intent
  decision: string    // AUTO / HUMAN
  scriptTitle: string // matched script
  outcome: string     // result description
  lesson?: string     // optional learning
}

// Rough token estimation
function estimateTokens(text: string): number {
  // Chinese: ~1.5 chars per token; English: ~4 chars per token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

/**
 * Read a memory file via Electron IPC
 */
export async function readMemory(file: MemoryFile): Promise<string> {
  try {
    const content = await window.electronAPI.readMemoryFile(file)
    return content || ''
  } catch {
    return ''
  }
}

/**
 * Write/append to a memory file via Electron IPC
 * Respects read-only rules and token limits
 */
export async function writeMemory(file: MemoryFile, content: string): Promise<boolean> {
  if (READ_ONLY_FILES.has(file)) {
    console.warn(`[MemoryManager] Cannot write to read-only file: ${file}`)
    return false
  }

  const limit = TOKEN_LIMITS[file] ?? 2000
  if (limit !== Infinity) {
    const tokens = estimateTokens(content)
    if (tokens > limit) {
      console.warn(`[MemoryManager] ${file} exceeds token limit (${tokens}/${limit}), needs distillation`)
      // Still write, but flag for distillation
    }
  }

  try {
    return await window.electronAPI.writeMemoryFile(file, content)
  } catch {
    return false
  }
}

/**
 * Append a line/section to a memory file
 */
export async function appendMemory(file: MemoryFile, section: string): Promise<boolean> {
  const current = await readMemory(file)
  const updated = current.trimEnd() + '\n' + section + '\n'
  return writeMemory(file, updated)
}

/**
 * Get today's date string: YYYY-MM-DD
 */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Read today's daily log
 */
export async function readDailyLog(date?: string): Promise<string> {
  const d = date || todayStr()
  try {
    const content = await window.electronAPI.readMemoryFile(`daily/${d}.md`)
    return content || ''
  } catch {
    return ''
  }
}

/**
 * Append an entry to today's daily log
 */
export async function appendDailyLog(entry: DailyLogEntry): Promise<boolean> {
  const d = todayStr()
  const existing = await readDailyLog(d)

  // Create header if file is empty
  let content = existing
  if (!content) {
    content = `# ${d} 处理日志\n\n## 处理记录\n`
  }

  const lessonPart = entry.lesson ? `\n  - 💡 ${entry.lesson}` : ''
  const line = `- [${entry.time}] ${entry.lang.toUpperCase()} | ${entry.intent} | ${entry.decision} → ${entry.scriptTitle} ${entry.outcome}${lessonPart}`

  content = content.trimEnd() + '\n' + line + '\n'

  try {
    return await window.electronAPI.writeMemoryFile(`daily/${d}.md`, content)
  } catch {
    return false
  }
}

/**
 * Read all memory files needed for context assembly
 */
export async function readAllMemories(): Promise<{
  constitution: string
  soul: string
  skills: string
  scriptsFeedback: string
  todayLog: string
  yesterdayLog: string
}> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const [constitution, soul, skills, scriptsFeedback, todayLog, yesterdayLog] = await Promise.all([
    readMemory('CONSTITUTION.md'),
    readMemory('SOUL.md'),
    readMemory('SKILLS.md'),
    readMemory('SCRIPTS_FEEDBACK.md'),
    readDailyLog(),
    readDailyLog(yesterdayStr),
  ])

  return { constitution, soul, skills, scriptsFeedback, todayLog, yesterdayLog }
}

/**
 * Check if a memory file needs distillation (over token limit)
 */
export function needsDistillation(file: MemoryFile, content: string): boolean {
  const limit = TOKEN_LIMITS[file]
  if (!limit || limit === Infinity) return false
  return estimateTokens(content) > limit * 0.9  // trigger at 90% capacity
}
