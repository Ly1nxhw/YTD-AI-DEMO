/**
 * Variable detection and replacement for {{变量}} patterns in generated replies.
 * Only activates when actual {{...}} markers are found — no false positives on normal text.
 */

// Match {{...}} but NOT escaped \{\{...\}\} or empty {{}}
const VAR_PATTERN = /\{\{([^{}]+?)\}\}/g

export interface TemplateVariable {
  /** The full match including braces, e.g. "{{订单号}}" */
  raw: string
  /** The variable name inside braces, e.g. "订单号" */
  name: string
  /** User-filled value, empty string initially */
  value: string
}

/**
 * Extract all unique {{变量}} from text.
 * Returns empty array if no variables found (no panel should be shown).
 */
export function extractVariables(text: string): TemplateVariable[] {
  if (!text) return []

  const seen = new Set<string>()
  const vars: TemplateVariable[] = []

  let match: RegExpExecArray | null
  const regex = new RegExp(VAR_PATTERN.source, 'g')

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0]
    const name = match[1].trim()
    if (name && !seen.has(raw)) {
      seen.add(raw)
      vars.push({ raw, name, value: '' })
    }
  }

  return vars
}

/**
 * Replace all {{变量}} in text with filled values.
 * Only replaces variables that have non-empty values.
 */
export function fillVariables(text: string, variables: TemplateVariable[]): string {
  let result = text
  for (const v of variables) {
    if (v.value.trim()) {
      // Replace all occurrences of this specific variable
      result = result.split(v.raw).join(v.value.trim())
    }
  }
  return result
}

/**
 * Check if text contains any {{变量}} patterns.
 * Fast check without extracting — use for gating UI.
 */
export function hasVariables(text: string): boolean {
  if (!text) return false
  return VAR_PATTERN.test(text)
}
