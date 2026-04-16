import type { ExtractedScript } from '@/lib/llm-adapter'
import type { LearnedScriptCandidate, LearningRiskFlag } from '@/types'

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?\u3000-\u303F\uFF00-\uFFEF]/g, '')
    .trim()
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function normalizeLearningText(value: string): string {
  return normalizeText(value)
}

export function validateLearnedScript(script: ExtractedScript): {
  normalizedTitle: string
  qualityScore: number
  flags: LearningRiskFlag[]
} {
  const flags: LearningRiskFlag[] = []
  let score = 100

  const title = script.title.trim()
  const category = script.category.trim()
  const content = script.content.trim()
  const scenario = script.scenario.trim()
  const keywords = script.keywords.map(keyword => keyword.trim()).filter(Boolean)

  if (!title) {
    flags.push({ level: 'blocker', code: 'missing_title', message: '缺少标题，无法直接入库。' })
    score -= 35
  } else if (title.length < 4) {
    flags.push({ level: 'warning', code: 'short_title', message: '标题过短，建议改成明确场景标题。' })
    score -= 10
  }

  if (!category) {
    flags.push({ level: 'blocker', code: 'missing_category', message: '缺少分类，后续检索会失效。' })
    score -= 25
  }

  if (!content) {
    flags.push({ level: 'blocker', code: 'missing_content', message: '缺少话术正文，不能保存。' })
    score -= 40
  } else if (content.length < 24) {
    flags.push({ level: 'warning', code: 'short_content', message: '正文偏短，建议补足完整回复逻辑。' })
    score -= 12
  }

  if (!scenario) {
    flags.push({ level: 'warning', code: 'missing_scenario', message: '缺少适用场景，建议补充。' })
    score -= 8
  }

  if (keywords.length < 2) {
    flags.push({ level: 'warning', code: 'few_keywords', message: '关键词太少，后续匹配召回会偏弱。' })
    score -= 8
  }

  const forbiddenPromisePattern = /(保证退款|包退|百分之百|100%|绝对|一定赔偿|永久免费|立刻到账|马上退款)/
  if (forbiddenPromisePattern.test(content)) {
    flags.push({ level: 'warning', code: 'risky_promise', message: '正文可能包含过度承诺，建议人工确认。' })
    score -= 15
  }

  const explicitOrderPattern = /(\b\d{6,}\b|https?:\/\/|亚马逊订单|订单号[:：]?\s*[A-Z0-9-]{6,})/i
  if (explicitOrderPattern.test(content) && !/{{[^{}]+}}/.test(content)) {
    flags.push({ level: 'warning', code: 'raw_specifics', message: '正文含具体订单或链接信息，建议替换为变量占位符。' })
    score -= 10
  }

  if (!/{{[^{}]+}}/.test(content) && /(\b\d{2,}\b|订单|日期|金额|链接)/.test(content)) {
    flags.push({ level: 'info', code: 'suggest_variables', message: '正文可能需要 {{变量}} 占位符，便于复用。' })
    score -= 4
  }

  return {
    normalizedTitle: normalizeText(title),
    qualityScore: clampScore(score),
    flags,
  }
}

export function buildLearnedScriptCandidate(
  id: string,
  script: ExtractedScript,
  mergeSuggestion: LearnedScriptCandidate['mergeSuggestion']
): LearnedScriptCandidate {
  const validation = validateLearnedScript(script)
  const hasBlockers = validation.flags.some(flag => flag.level === 'blocker')
  const chosenAction = hasBlockers
    ? 'ignore'
    : mergeSuggestion.action === 'ignore'
      ? 'create'
      : mergeSuggestion.action

  return {
    id,
    ...script,
    normalizedTitle: validation.normalizedTitle,
    qualityScore: validation.qualityScore,
    flags: validation.flags,
    mergeSuggestion,
    chosenAction,
  }
}
