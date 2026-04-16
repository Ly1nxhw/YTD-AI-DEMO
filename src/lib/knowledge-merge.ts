import type { ExtractedScript } from '@/lib/llm-adapter'
import { normalizeLearningText } from '@/lib/learning-validator'
import type { KnowledgeEntry, KnowledgeMergeSuggestion } from '@/types'

function toTokens(values: string[]): Set<string> {
  const tokens = new Set<string>()
  for (const value of values) {
    const parts = value
      .toLowerCase()
      .match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? []
    for (const part of parts) {
      if (part.length >= 2) {
        tokens.add(part)
      }
    }
  }
  return tokens
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of left) {
    if (right.has(token)) {
      intersection++
    }
  }

  return intersection / Math.max(left.size, right.size)
}

function compareScriptToEntry(candidate: ExtractedScript, entry: KnowledgeEntry): number {
  const candidateTitle = normalizeLearningText(candidate.title)
  const entryTitle = normalizeLearningText(entry.title)
  const titleScore =
    candidateTitle && entryTitle
      ? candidateTitle === entryTitle
        ? 1
        : candidateTitle.includes(entryTitle) || entryTitle.includes(candidateTitle)
          ? 0.82
          : 0
      : 0

  const keywordScore = overlapScore(
    toTokens(candidate.keywords),
    toTokens(entry.keywords)
  )

  const contentScore = overlapScore(
    toTokens([candidate.content, candidate.scenario]),
    toTokens([entry.content, entry.scenario])
  )

  const categoryScore = candidate.category.trim() && candidate.category === entry.category ? 1 : 0

  return titleScore * 0.45 + keywordScore * 0.25 + contentScore * 0.2 + categoryScore * 0.1
}

export function suggestKnowledgeMerge(
  candidate: ExtractedScript,
  entries: KnowledgeEntry[]
): KnowledgeMergeSuggestion {
  const activeEntries = entries.filter(entry => !entry.deleted)
  let bestMatch: KnowledgeEntry | null = null
  let bestScore = 0

  for (const entry of activeEntries) {
    const score = compareScriptToEntry(candidate, entry)
    if (score > bestScore) {
      bestScore = score
      bestMatch = entry
    }
  }

  if (!bestMatch) {
    return {
      action: 'create',
      confidence: 0.25,
      reasons: ['知识库中没有可比对条目，建议新建。'],
    }
  }

  if (bestScore >= 0.78) {
    return {
      action: 'update_existing',
      confidence: Number(bestScore.toFixed(2)),
      targetEntryId: bestMatch.id,
      targetEntryTitle: bestMatch.title,
      reasons: ['标题或语义高度相似，更像是已有话术的增强版。'],
    }
  }

  if (bestScore >= 0.58) {
    return {
      action: 'create',
      confidence: Number(bestScore.toFixed(2)),
      targetEntryId: bestMatch.id,
      targetEntryTitle: bestMatch.title,
      reasons: ['发现相近话术，但差异仍足够大，默认建议新建。'],
    }
  }

  return {
    action: 'create',
    confidence: Number(bestScore.toFixed(2)),
    reasons: ['与现有条目重合度较低，建议新建。'],
  }
}
