/**
 * Variable detection and replacement for {{变量}} patterns in generated replies.
 * Only activates when actual {{...}} markers are found — no false positives on normal text.
 *
 * Date variables are auto-detected and formatted via Intl.DateTimeFormat.
 * Other variables use a single text input applied to both foreign and Chinese texts.
 */

const VAR_PATTERN = /\{\{([^{}]+?)\}\}/g

// Words that indicate a date variable (any language)
const DATE_KEYWORDS = [
  '日期', '时间', '发货日期', '签收日期', '退款日期',
  'date', 'fecha', 'datum', 'data', 'giorno',
]

export type VarType = 'date' | 'text'

export interface TemplateVariable {
  /** Full match in foreign reply, e.g. "{{fecha}}" */
  raw: string
  /** Variable name (foreign), e.g. "fecha" */
  name: string
  /** Full match in Chinese text, e.g. "{{日期}}" */
  rawChinese: string
  /** Variable name (Chinese), e.g. "日期" */
  nameChinese: string
  /** Auto-detected type */
  type: VarType
  /** For date: ISO string "2026-04-03"; for text: the value */
  inputValue: string
}

// ===== Detection =====

function extractRaw(text: string): Array<{ raw: string; name: string }> {
  if (!text) return []
  const results: Array<{ raw: string; name: string }> = []
  const seen = new Set<string>()
  const regex = new RegExp(VAR_PATTERN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    const raw = m[0], name = m[1].trim()
    if (name && !seen.has(raw)) { seen.add(raw); results.push({ raw, name }) }
  }
  return results
}

function detectType(foreignName: string, chineseName: string): VarType {
  const combined = `${foreignName} ${chineseName}`.toLowerCase()
  return DATE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase())) ? 'date' : 'text'
}

/**
 * Extract paired variables from foreign + Chinese text.
 */
export function extractVariables(replyText: string, chineseText?: string): TemplateVariable[] {
  const rv = extractRaw(replyText)
  const cv = extractRaw(chineseText || '')
  if (rv.length === 0 && cv.length === 0) return []

  const len = Math.max(rv.length, cv.length)
  const vars: TemplateVariable[] = []
  for (let i = 0; i < len; i++) {
    const r = rv[i], c = cv[i]
    const foreignName = r?.name || c?.name || ''
    const chineseName = c?.name || r?.name || ''
    vars.push({
      raw: r?.raw || c?.raw || '',
      name: foreignName,
      rawChinese: c?.raw || r?.raw || '',
      nameChinese: chineseName,
      type: detectType(foreignName, chineseName),
      inputValue: '',
    })
  }
  return vars
}

// ===== Date formatting =====

const LOCALE_MAP: Record<string, string> = {
  de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES',
  it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL', pt: 'pt-PT',
  ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', auto: 'en-GB',
}

export function formatDate(isoDate: string, langCode: string): string {
  if (!isoDate) return ''
  const date = new Date(isoDate + 'T00:00:00')
  if (isNaN(date.getTime())) return isoDate
  const locale = LOCALE_MAP[langCode] || langCode
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

export function formatDateChinese(isoDate: string): string {
  if (!isoDate) return ''
  const date = new Date(isoDate + 'T00:00:00')
  if (isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

// ===== Replacement =====

export function fillBothTexts(
  replyText: string,
  chineseText: string,
  variables: TemplateVariable[],
  targetLang: string,
): { filledReply: string; filledChinese: string } {
  let filledReply = replyText
  let filledChinese = chineseText

  for (const v of variables) {
    if (!v.inputValue) continue

    if (v.type === 'date') {
      const foreignFormatted = formatDate(v.inputValue, targetLang)
      const chineseFormatted = formatDateChinese(v.inputValue)
      if (v.raw) filledReply = filledReply.split(v.raw).join(foreignFormatted)
      if (v.rawChinese) filledChinese = filledChinese.split(v.rawChinese).join(chineseFormatted)
    } else {
      // Text variables: same value for both
      if (v.raw) filledReply = filledReply.split(v.raw).join(v.inputValue)
      if (v.rawChinese) filledChinese = filledChinese.split(v.rawChinese).join(v.inputValue)
    }
  }

  return { filledReply, filledChinese }
}

/**
 * Quick check: does text contain any {{...}} ?
 */
export function hasVariables(text: string): boolean {
  if (!text) return false
  return VAR_PATTERN.test(text)
}
