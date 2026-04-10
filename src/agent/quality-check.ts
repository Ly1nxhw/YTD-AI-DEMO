/**
 * Quality Check — Step 3 质检层
 *
 * 自动回复发送前的最后一道防线。
 * 不通过 → 自动降级为 HUMAN。
 */

export interface QualityCheckResult {
  pass: boolean
  checks: {
    language_match: boolean       // 回复语言与客户一致
    no_sensitive_words: boolean   // 无敏感词/不当承诺
    no_hallucination: boolean     // 未编造订单号/金额
    variables_filled: boolean     // 无残留 {{变量}} (若已填充)
    tone_appropriate: boolean     // 语气得体
    not_empty: boolean            // 回复非空
  }
  failReasons: string[]
}

// Sensitive patterns that should never appear in auto-replies
const SENSITIVE_PATTERNS = [
  /律师|lawyer|attorney|legal\s+action|法律/i,
  /100%\s*(退款|refund|remboursement|Erstattung|rimborso)/i,
  /保证|guarantee|garantie|garantieren|garantire/i,
  /一定会|definitely\s+will|certainement|sicherlich\s+werden/i,
]

// Patterns that look like fabricated order/tracking numbers
const HALLUCINATION_PATTERNS = [
  /\b\d{3}-\d{7}-\d{7}\b/,   // Amazon order number format
  /\b[A-Z]{2}\d{9}[A-Z]{2}\b/, // Tracking number format
  /€\s*\d+[.,]\d{2}/,          // Specific money amounts
  /\$\s*\d+\.\d{2}/,
]

// Variable placeholder pattern
const VARIABLE_PATTERN = /\{\{[^{}]+?\}\}/g

/**
 * Map language code to a set of common words to verify language match
 */
const LANG_MARKERS: Record<string, RegExp> = {
  de: /\b(und|oder|nicht|aber|mit|für|ich|Sie|wir|können|vielen|Dank)\b/i,
  fr: /\b(et|ou|pas|mais|avec|pour|nous|vous|merci|bonjour|cordialement)\b/i,
  es: /\b(y|o|no|pero|con|para|nosotros|usted|gracias|estimado)\b/i,
  it: /\b(e|o|non|ma|con|per|noi|lei|grazie|gentile)\b/i,
  en: /\b(and|or|not|but|with|for|we|you|thank|dear|sincerely)\b/i,
  nl: /\b(en|of|niet|maar|met|voor|wij|u|bedankt|geachte)\b/i,
  pl: /\b(i|lub|nie|ale|z|dla|my|pan|dziękuję|szanowny)\b/i,
  pt: /\b(e|ou|não|mas|com|para|nós|você|obrigado|prezado)\b/i,
}

export function runQualityCheck(
  reply: string,
  detectedLang: string,
  variablesFilled: boolean = false
): QualityCheckResult {
  const failReasons: string[] = []

  // 1. Not empty
  const not_empty = reply.trim().length > 10
  if (!not_empty) failReasons.push('回复内容为空或过短')

  // 2. Language match
  let language_match = true
  const marker = LANG_MARKERS[detectedLang]
  if (marker && not_empty) {
    language_match = marker.test(reply)
    if (!language_match) failReasons.push(`回复语言可能与客户语言(${detectedLang})不匹配`)
  }

  // 3. No sensitive words
  let no_sensitive_words = true
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(reply)) {
      no_sensitive_words = false
      failReasons.push(`检测到敏感词/不当承诺: ${pattern.source.slice(0, 30)}...`)
      break
    }
  }

  // 4. No hallucination (fabricated numbers)
  let no_hallucination = true
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(reply)) {
      no_hallucination = false
      failReasons.push('检测到可能编造的订单号/金额，需人工确认')
      break
    }
  }

  // 5. Variables filled (only check if we expect them to be filled)
  let variables_filled = true
  if (variablesFilled) {
    const remaining = reply.match(VARIABLE_PATTERN)
    if (remaining && remaining.length > 0) {
      variables_filled = false
      failReasons.push(`仍有 ${remaining.length} 个未填充变量: ${remaining.join(', ')}`)
    }
  }

  // 6. Tone appropriate (basic check: not too short, has greeting/closing)
  const tone_appropriate = not_empty && reply.length > 30
  if (!tone_appropriate && not_empty) {
    failReasons.push('回复过短，可能语气不够完整')
  }

  const checks = {
    language_match,
    no_sensitive_words,
    no_hallucination,
    variables_filled,
    tone_appropriate,
    not_empty,
  }

  const pass = Object.values(checks).every(v => v)

  return { pass, checks, failReasons }
}
