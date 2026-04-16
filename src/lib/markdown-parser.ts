import type { KnowledgeBase, KnowledgeEntry } from '@/types'

/**
 * Parse imported markdown text into a structured KnowledgeBase
 */
export function parseMarkdownToKnowledgeBase(markdown: string): KnowledgeBase {
  const entries: KnowledgeEntry[] = []
  const categories: string[] = []

  const lines = markdown.split('\n')
  let currentCategory = ''
  let currentTitle = ''
  let currentContent: string[] = []
  let entryIndex = 0

  const flushEntry = () => {
    if (currentTitle && currentContent.length > 0) {
      const content = currentContent.join('\n').trim()
      const keywords = extractKeywords(currentTitle, content)
      entries.push({
        id: `entry-${entryIndex++}`,
        category: currentCategory,
        title: currentTitle,
        keywords,
        content,
        scenario: currentCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    currentContent = []
    currentTitle = ''
  }

  for (const line of lines) {
    // Match category: ## 一、物流配送类
    const categoryMatch = line.match(/^## (.+)/)
    if (categoryMatch) {
      flushEntry()
      currentCategory = categoryMatch[1].replace(/^[一二三四五六七八九十]+、/, '').trim()
      if (!categories.includes(currentCategory)) {
        categories.push(currentCategory)
      }
      continue
    }

    // Match entry title: ### 1. xxx
    const titleMatch = line.match(/^### \d+\.\s*(.+)/)
    if (titleMatch) {
      flushEntry()
      currentTitle = titleMatch[1].trim()
      continue
    }

    // Skip top-level heading and horizontal rules
    if (line.match(/^# /) || line.match(/^---\s*$/)) {
      continue
    }

    // Accumulate content
    if (currentTitle) {
      currentContent.push(line)
    }
  }

  // Flush last entry
  flushEntry()

  return {
    version: '1.0.0',
    entries,
    categories,
  }
}

/**
 * Extract keywords from title and content for TF-IDF matching
 */
function extractKeywords(title: string, content: string): string[] {
  const keywords = new Set<string>()

  // Common customer service keywords to look for
  const keywordPatterns = [
    '包裹', '快递', '派送', '签收', '配送', '物流', '运输', '追踪', '延迟', '丢失',
    '退款', '退货', '退回', '退还', '退费', '取消',
    '换新', '更换', '替换', '发送新',
    '质量', '故障', '损坏', '坏了', '缺陷', '无法启动', '不充电', '不工作',
    '配件', '零件', '螺丝', '刀片', '电池', '充电器', '手柄', '草绳',
    '锯片', '圆锯', '锯刀', '切割', '锯条',
    '购买', '出售', '单独', '通用', '兼容', '适配', '替代',
    '发票', '订单', '客服', '补偿', '赔偿',
    '自提点', '快递站', '地址', '签名', '文件',
    '产品', '设备', '机器', '电锯', '割灌机', '割草机', '修剪机', '修枝剪',
    '梯子', '鼓风机', '打草机', '除草机',
    '索赔', '投诉', '不满意',
  ]

  const combinedText = title + ' ' + content

  for (const kw of keywordPatterns) {
    if (combinedText.includes(kw)) {
      keywords.add(kw)
    }
  }

  // Also extract keywords from the title by splitting
  const titleWords = title
    .replace(/[（）()—\-\/\s]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2)
  for (const w of titleWords) {
    keywords.add(w)
  }

  return Array.from(keywords)
}
