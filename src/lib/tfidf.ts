import type { KnowledgeEntry, MatchedEntry } from '@/types'

/**
 * Enhanced matching for Chinese customer service knowledge base.
 * Combines TF-IDF keyword matching, content overlap, and synonym expansion.
 */

// ===== Synonym Groups =====
// Words within the same group are treated as related during matching
const SYNONYM_GROUPS: string[][] = [
  ['配件', '零件', '部件', '附件', '备件'],
  ['刀片', '锯片', '圆锯', '锯刀', '切割片', '切割线', '锯条'],
  ['购买', '买', '出售', '卖', '采购', '选购', '获取'],
  ['单独', '单卖', '分开', '另外', '额外'],
  ['通用', '兼容', '适配', '匹配', '适用', '替代', '替换'],
  ['割灌机', '割草机', '除草机', '打草机', '修剪机', '修枝剪', '草坪机'],
  ['损坏', '坏了', '故障', '不工作', '无法使用', '缺陷', '不充电', '无法启动'],
  ['退款', '退货', '退回', '退还', '退费'],
  ['快递', '包裹', '物流', '配送', '派送', '运输'],
  ['补偿', '赔偿', '补贴', '折扣'],
]

// Build a fast lookup: word -> all its synonyms
const synonymMap = new Map<string, Set<string>>()
for (const group of SYNONYM_GROUPS) {
  const fullSet = new Set(group)
  for (const word of group) {
    const existing = synonymMap.get(word)
    if (existing) {
      for (const w of fullSet) existing.add(w)
    } else {
      synonymMap.set(word, new Set(fullSet))
    }
  }
}

function getSynonyms(word: string): string[] {
  // Direct lookup
  const direct = synonymMap.get(word)
  if (direct) return Array.from(direct)

  // Partial match: if the word contains a synonym key or vice-versa
  const results = new Set<string>()
  for (const [key, syns] of synonymMap.entries()) {
    if (word.includes(key) || key.includes(word)) {
      for (const s of syns) results.add(s)
    }
  }
  return Array.from(results)
}

// ===== Tokenization =====

function tokenize(text: string): string[] {
  const compounds = text.match(/[\u4e00-\u9fa5]{2,4}/g) || []
  const singles = text.match(/[\u4e00-\u9fa5]/g) || []
  return [...compounds, ...singles]
}

// ===== Matching Helpers =====

/** Check if two words are related (exact, substring, or synonym) */
function wordsRelated(a: string, b: string): boolean {
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const synsA = getSynonyms(a)
  if (synsA.some(s => s === b || s.includes(b) || b.includes(s))) return true
  return false
}

function termFrequency(terms: string[], token: string): number {
  const count = terms.filter(t => wordsRelated(t, token)).length
  return count / Math.max(terms.length, 1)
}

function inverseDocumentFrequency(docs: string[][], token: string): number {
  const docsWithToken = docs.filter(doc =>
    doc.some(t => wordsRelated(t, token))
  ).length
  return Math.log((docs.length + 1) / (docsWithToken + 1)) + 1
}

/** Count overlapping Chinese characters between two texts */
function contentOverlap(textA: string, textB: string): number {
  const charsA = new Set(textA.match(/[\u4e00-\u9fa5]/g) || [])
  const charsB = new Set(textB.match(/[\u4e00-\u9fa5]/g) || [])
  let overlap = 0
  for (const c of charsA) {
    if (charsB.has(c)) overlap++
  }
  return overlap / Math.max(charsA.size, 1)
}

// ===== Intent → Category Mapping =====
// Maps intent keywords to knowledge base category names
const INTENT_CATEGORY_MAP: Record<string, string[]> = {
  '退货': ['退款退货类'],
  '退款': ['退款退货类'],
  '退回': ['退款退货类'],
  '退费': ['退款退货类'],
  '不满意': ['退款退货类'],
  '取消': ['退款退货类'],
  '物流': ['物流配送类'],
  '配送': ['物流配送类'],
  '快递': ['物流配送类'],
  '包裹': ['物流配送类'],
  '派送': ['物流配送类'],
  '签收': ['物流配送类'],
  '质量': ['产品质量', '产品质量 / 故障类'],
  '故障': ['产品质量', '产品质量 / 故障类'],
  '损坏': ['产品质量', '产品质量 / 故障类'],
  '不工作': ['产品质量', '产品质量 / 故障类'],
  '配件': ['配件零件类'],
  '零件': ['配件零件类'],
  '刀片': ['配件零件类'],
  '购买': ['配件零件类'],
}

/** Extract matching category names from an intent string */
function intentToCategories(intent: string): string[] {
  const cats = new Set<string>()
  for (const [keyword, categories] of Object.entries(INTENT_CATEGORY_MAP)) {
    if (intent.includes(keyword)) {
      for (const c of categories) cats.add(c)
    }
  }
  return Array.from(cats)
}

/**
 * Match keywords from Step 1 against knowledge base entries.
 * Uses TF-IDF + synonym expansion + content overlap + intent-based category boosting.
 * Returns top-N matches sorted by relevance score.
 */
export function matchKeywords(
  keywords: string[],
  entries: KnowledgeEntry[],
  topN: number = 3,
  threshold: number = 0.08,
  chineseTranslation?: string,
  intent?: string
): MatchedEntry[] {
  if (keywords.length === 0 || entries.length === 0) {
    return []
  }

  // Determine intent-preferred categories
  const preferredCategories = intent ? intentToCategories(intent) : []

  // Expand keywords with synonyms
  const expandedKeywords = new Set<string>(keywords)
  for (const kw of keywords) {
    for (const syn of getSynonyms(kw)) {
      expandedKeywords.add(syn)
    }
  }
  const allKeywords = Array.from(expandedKeywords)

  // Build document term lists
  const docTerms = entries.map(entry => {
    const text = entry.title + ' ' + entry.keywords.join(' ') + ' ' + entry.content
    return tokenize(text)
  })

  // Calculate scores for each entry
  const scored: MatchedEntry[] = entries.map((entry, idx) => {
    let score = 0
    const entryTerms = docTerms[idx]

    // 1) TF-IDF keyword matching (with synonyms)
    for (const keyword of allKeywords) {
      const tf = termFrequency(entryTerms, keyword)
      const idf = inverseDocumentFrequency(docTerms, keyword)
      score += tf * idf

      // Boost: exact keyword match in entry keywords list
      if (entry.keywords.some(k => wordsRelated(k, keyword))) {
        score += 0.5
      }

      // Boost: keyword in title
      if (entry.title.includes(keyword) || getSynonyms(keyword).some(s => entry.title.includes(s))) {
        score += 0.3
      }
    }

    // 2) Content overlap: compare Step 1 Chinese translation against entry content
    if (chineseTranslation) {
      const overlap = contentOverlap(chineseTranslation, entry.title + ' ' + entry.content)
      score += overlap * 2.0
    }

    // 3) Direct substring matching: check if original keywords appear in entry content
    const entryFullText = entry.title + ' ' + entry.content
    for (const kw of keywords) {
      if (entryFullText.includes(kw)) {
        score += 0.4
      }
      for (const syn of getSynonyms(kw)) {
        if (entryFullText.includes(syn)) {
          score += 0.2
        }
      }
    }

    // 4) Intent-based category boosting: strongly prefer entries whose category matches the intent
    if (preferredCategories.length > 0) {
      const categoryMatches = preferredCategories.some(pc =>
        entry.category.includes(pc) || pc.includes(entry.category)
      )
      if (categoryMatches) {
        score *= 1.8  // 80% boost for intent-matching category
      } else {
        score *= 0.6  // 40% penalty for non-matching category
      }
    }

    return { entry, score }
  })

  // Sort by score descending and filter by threshold
  return scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
