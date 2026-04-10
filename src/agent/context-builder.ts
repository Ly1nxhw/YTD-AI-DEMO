/**
 * Context Builder — 上下文动态拼装引擎
 *
 * 三明治结构（重要内容在首尾，利用 LLM 注意力分布）:
 *   1. CONSTITUTION.md  (宪法 — 置顶)
 *   2. SOUL.md          (风格人设)
 *   3. SKILLS.md        (技能经验 — 相关段落)
 *   4. today.md         (今日日志摘要)
 *   5. SCRIPTS_FEEDBACK (相关条目)
 *   6. ───── 当前消息 ─────
 *   7. 话术内容          (RAG / catalog)
 *   8. CONSTITUTION 关键规则重复 (尾部强化)
 */

import { readAllMemories } from './memory-manager'

export interface ContextParts {
  constitution: string
  soul: string
  skills: string
  scriptsFeedback: string
  todayLog: string
  yesterdayLog: string
}

/**
 * Extract sections from a markdown file that are relevant to the query.
 * Simple keyword-based relevance — works well enough without embeddings.
 */
function extractRelevantSections(
  markdown: string,
  keywords: string[],
  maxSections: number = 5
): string {
  if (!markdown.trim()) return ''

  // Split by ## headers
  const sections = markdown.split(/(?=^##\s)/m).filter(s => s.trim())

  if (keywords.length === 0 || sections.length <= maxSections) {
    return markdown
  }

  // Score each section by keyword hits
  const scored = sections.map(section => {
    const lower = section.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++
    }
    return { section, score }
  })

  // Always include the first section (usually the title/header)
  const first = scored.shift()
  const sorted = scored.sort((a, b) => b.score - a.score)
  const top = sorted.slice(0, maxSections)

  const parts = first ? [first.section] : []
  for (const item of top) {
    if (item.score > 0) {
      parts.push(item.section)
    }
  }

  return parts.join('\n').trim()
}

/**
 * Trim a daily log to a summary (last N entries)
 */
function trimDailyLog(log: string, maxEntries: number = 10): string {
  if (!log.trim()) return ''
  const lines = log.split('\n')
  const entries = lines.filter(l => l.startsWith('- ['))
  if (entries.length <= maxEntries) return log

  // Keep header + last N entries
  const header = lines.filter(l => !l.startsWith('- [')).join('\n')
  const recent = entries.slice(-maxEntries).join('\n')
  return `${header}\n${recent}`
}

/**
 * Extract key rules from CONSTITUTION for tail reinforcement
 */
function extractKeyRules(constitution: string): string {
  const lines = constitution.split('\n')
  const keyLines: string[] = []

  let inSection = false
  for (const line of lines) {
    if (line.startsWith('## 绝对禁止') || line.startsWith('## 必须升级人工')) {
      inSection = true
      keyLines.push(line)
      continue
    }
    if (line.startsWith('## ') && inSection) {
      inSection = false
    }
    if (inSection && line.startsWith('- ')) {
      keyLines.push(line)
    }
  }

  return keyLines.length > 0
    ? '⚠️ 关键规则提醒:\n' + keyLines.join('\n')
    : ''
}

export interface BuildContextOptions {
  /** Keywords from customer message (for relevant section extraction) */
  keywords: string[]
  /** The script catalog string (话术列表) */
  scriptCatalog: string
  /** Customer message */
  customerMessage: string
}

/**
 * Build the full system prompt by assembling memory + context.
 * This replaces the static DEFAULT_PROMPT_A with a dynamic, memory-aware prompt.
 */
export async function buildTriageContext(opts: BuildContextOptions): Promise<string> {
  const memories = await readAllMemories()

  const relevantSkills = extractRelevantSections(memories.skills, opts.keywords, 5)
  const relevantFeedback = extractRelevantSections(memories.scriptsFeedback, opts.keywords, 3)
  const todaySummary = trimDailyLog(memories.todayLog, 10)
  const keyRules = extractKeyRules(memories.constitution)

  const parts: string[] = []

  // 1. Constitution (top — highest weight)
  parts.push(memories.constitution)

  // 2. Soul (style)
  if (memories.soul.trim()) {
    parts.push(memories.soul)
  }

  // 3. Relevant skills
  if (relevantSkills) {
    parts.push('---\n# 相关经验\n' + relevantSkills)
  }

  // 4. Today's log summary
  if (todaySummary) {
    parts.push('---\n# 今日处理记录（参考）\n' + todaySummary)
  }

  // 5. Script feedback
  if (relevantFeedback) {
    parts.push('---\n# 话术匹配反馈\n' + relevantFeedback)
  }

  // 6. Task instructions
  parts.push(`---
# 当前任务

分析以下客户消息，完成两个任务：

## 任务一：智能分流
判断该消息应该 AUTO（AI自动回复）还是 HUMAN（升级人工）。

## 任务二：话术匹配
从话术库中选出最合适的回复模板。

IMPORTANT: Output ONLY a single valid JSON object, no markdown, no explanation, no text before or after.

JSON schema:
{"triage":{"decision":"AUTO or HUMAN","complexity":1-10,"sentiment":"positive|neutral|negative|angry","risk_level":"low|medium|high","reason":"string"},"chinese_translation":"string","detected_language":"de|en|fr|es|it|nl|pl|pt|ja|ko","intent":"string","keywords":["k1","k2"],"matched_ids":["id1"],"suggested_strategy":"string or null"}

Rules:
- Output raw JSON only. Do NOT wrap in \`\`\`json code fences.
- matched_ids must contain actual IDs from the 话术库 above.
- suggested_strategy is required only when decision is HUMAN, otherwise set to null.`)

  // 7. Script catalog
  parts.push('---\n# 话术库\n' + opts.scriptCatalog)

  // 8. Key rules reinforcement (tail)
  if (keyRules) {
    parts.push('---\n' + keyRules)
  }

  return parts.join('\n\n')
}

/**
 * Build context for Step 2 (reply generation).
 * Injects soul (style preferences) into the generation prompt.
 */
export async function buildGenerationContext(opts: {
  customerMessage: string
  targetLang: string
  scriptContent: string
  keywords: string[]
}): Promise<string> {
  const memories = await readAllMemories()

  const relevantSkills = extractRelevantSections(memories.skills, opts.keywords, 3)

  const parts: string[] = []

  parts.push(`你是一名专业的跨境电商客服翻译助手。请根据以下信息生成客服回复。`)

  // Inject soul style
  if (memories.soul.trim()) {
    parts.push('---\n# 风格要求\n' + memories.soul)
  }

  // Inject relevant skills
  if (relevantSkills) {
    parts.push('---\n# 相关经验\n' + relevantSkills)
  }

  parts.push(`---
**客户原文**: ${opts.customerMessage}
**回复语言**: ${opts.targetLang}
**参考话术**:
${opts.scriptContent}

要求:
1. 使用参考话术为基础，根据客户具体情况适当调整
2. 输出格式：先输出目标语言回复，然后输出"---中文翻译---"，再输出中文版本
3. 保留 {{变量}} 标记不替换
4. 语气和风格遵循上方"风格要求"`)

  return parts.join('\n\n')
}
