import type {
  LLMProvider,
  Step1Result,
  Step2Result,
  MatchedEntry,
  KnowledgeEntry,
  WorkspaceInitProfile,
  GeneratedKnowledgeScript,
} from '@/types'
import { buildTriageContext } from '@/agent/context-builder'

// ===== Default Prompts =====

export const DEFAULT_PROMPT_A = `你是一个多语言客服消息分析助手。你需要分析客户消息，并从话术库中选出最合适的回复模板。

请分析以下客户消息，输出严格的JSON格式：

{
  "chinese_translation": "客户消息的中文翻译",
  "detected_language": "语言代码(如de, en, fr, es, it等)",
  "intent": "意图分类",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "matched_ids": ["匹配的话术ID1"]
}

要求：
1. chinese_translation: 准确翻译为中文
2. detected_language: ISO 639-1 语言代码
3. intent: 简短的意图分类描述
4. keywords: 提取3-5个中文关键词
5. matched_ids: 从下方【话术库】中选出**1条**最匹配的话术ID（特殊情况可选2条）。

**核心选择原则 — 客服策略优先级**：
你是站在卖家角度为客户服务的。选择话术时必须遵循以下业务策略：

【退货/退款场景】客户提到退货、退款、不满意、要退回产品时：
  ① 如果客户没有明确说过退货原因 → 选"询问退货原因"
  ② 如果客户表达了不满但未坚持退货 → 选"部分退款挽留"（优先保住订单）
  ③ 只有当客户明确坚持要退且已沟通过 → 才选"退货标签"或"退货流程"类话术
  ④ "引导联系亚马逊退货"只用于FBA订单且客户明确要求退款时
  ⚠ 即使客户问"怎么退货"、"退到哪里"，如果这是首次对话，仍应先选①或②，因为我们的策略是先了解原因、尝试挽留

【物流场景】只有当客户明确提到包裹、快递、配送问题时才选物流类话术
【产品问题/故障场景】
  - 客户反映产品故障（无法启动、电池不充电、零件损坏等）→ 优先选"产品质量/故障类"话术
  - 电池相关问题（不充电、续航短、电池坏了）→ 优先看"电池"相关话术（如"电池备件缺货"、"充电器故障"等），而非通用配件话术
  - 优先选"建议换新"而非直接退款
【配件场景】客户明确问是否有配件（刀片、手柄、草绳等非电池类）可以购买 → 选配件类话术。注意：电池/充电器问题不属于此场景

如果确实没有匹配话术，返回空数组 []

6. 仅输出JSON，不要添加任何其他文字

【话术库】
{script_catalog}`

export const DEFAULT_PROMPT_B = `你是一名专业的跨境电商客服翻译助手。请根据以下信息生成客服回复：

**客户原文**: {customer_message}
**客户消息中文翻译**: {chinese_translation}
**客户意图**: {intent}
**匹配的话术模板**: 
{matched_scripts}

**目标回复语言**: {target_language}
**是否有匹配话术**: {has_match}

请输出严格的JSON格式：
{
  "reply": "用目标语言({target_language})撰写的客服回复",
  "chinese": "上述回复的中文逐段对照翻译",
  "unmatched": false
}

要求：
1. 如果有匹配话术(has_match=true)：
   - 你的核心任务是【忠实翻译】话术模板到目标语言，而不是重新创作
   - 必须严格保留话术模板中的所有具体信息，包括：搜索关键词、产品名称、金额数字、产品代码、链接等，一字不改地翻译到目标语言
   - 例如话术中提到"搜索'通用草坪修剪机刀片，与 3 合 1 割草机、迷你割草机和修剪机兼容'"，翻译时必须完整保留这个搜索词的译文
   - 只允许微调称呼和礼貌用语以适配目标语言的文化习惯，不得删减或改写话术的核心内容
2. 如果没有匹配话术(has_match=false)，基于通用客服能力生成专业回复，并将unmatched设为true
3. 回复语气专业、友善、有同理心
4. 中文对照必须与外语回复逐段对应，且中文对照应与原始话术模板内容一致
5. **变量标记**：如果话术模板中包含 {{变量名}} 格式的占位符（如 {{订单号}}、{{日期}}、{{金额}}），在翻译到目标语言时必须原样保留双花括号格式，只翻译花括号内的变量名。例如：{{订单号}} → {{Bestellnummer}}（德语）或 {{order number}}（英语）。中文对照中保留原始中文变量名如 {{订单号}}
6. 仅输出JSON，不要添加任何其他文字`

// ===== LLM Adapter =====

interface StreamCallbacks {
  onToken?: (token: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: string) => void
}

export interface TriageResult {
  triage: {
    decision: 'AUTO' | 'HUMAN'
    complexity: number
    sentiment: 'positive' | 'neutral' | 'negative' | 'angry'
    risk_level: 'low' | 'medium' | 'high'
    reason: string
  }
  chinese_translation: string
  detected_language: string
  intent: string
  keywords: string[]
  matched_ids: string[]
  suggested_strategy?: string
}

const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 30000

/**
 * Call OpenAI-compatible API (works with OpenAI, DeepSeek, Ollama, etc.)
 */
async function callOpenAICompatible(
  provider: LLMProvider,
  systemPrompt: string,
  userMessage: string,
  model?: string,
  stream?: boolean,
  callbacks?: StreamCallbacks,
  maxTokensOverride?: number
): Promise<string> {
  const url = `${provider.apiUrl.replace(/\/$/, '')}/chat/completions`
  const useModel = model || provider.model

  // Qwen3/3.5 models default to thinking mode — disable it for translation tasks (massive speedup)
  const isQwen3 = /qwen3/i.test(useModel)

  const body: any = {
    model: useModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: provider.temperature ?? 0.3,
    max_tokens: maxTokensOverride ?? provider.maxTokens ?? 2000,
    stream: stream ?? false,
    ...(isQwen3 && { enable_thinking: false }),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  // Use Electron IPC proxy if available (bypasses CORS), fallback to direct fetch
  const useProxy = typeof window !== 'undefined' && window.electronAPI?.llmProxy

  // Retry loop with exponential backoff
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await new Promise(r => setTimeout(r, delay))
      console.log(`[LLM] Retry attempt ${attempt}/${MAX_RETRIES}`)
    }

    try {
      if (useProxy) {
        // ---- IPC proxy path (Node.js, no CORS) ----
        const result = await window.electronAPI.llmProxy({
          url,
          headers,
          body: JSON.stringify(body),
          stream: stream ?? false,
        })

        if (!result.ok) {
          lastError = new Error(`LLM API error ${result.status}: ${result.error}`)
          if (result.status >= 500) continue
          throw lastError
        }

        if (stream && callbacks && result.stream) {
          // Parse SSE text returned from proxy
          const sseText = result.body as string
          const lines = sseText.split('\n').filter((l: string) => l.startsWith('data: '))
          let fullText = ''

          for (const line of lines) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              const token = parsed.choices?.[0]?.delta?.content || ''
              if (token) {
                fullText += token
                callbacks.onToken?.(token)
              }
            } catch {
              // Skip malformed JSON lines
            }
          }

          callbacks.onComplete?.(fullText)
          return fullText
        }

        // Non-streaming proxy response
        return result.body?.choices?.[0]?.message?.content || ''

      } else {
        // ---- Direct fetch path (for non-Electron or local Ollama) ----
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
          const errorText = await response.text()
          lastError = new Error(`LLM API error ${response.status}: ${errorText}`)
          if (response.status >= 500) continue
          throw lastError
        }

        if (stream && callbacks) {
          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body for streaming')

          const decoder = new TextDecoder()
          let fullText = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

            for (const line of lines) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                callbacks.onComplete?.(fullText)
                return fullText
              }

              try {
                const parsed = JSON.parse(data)
                const token = parsed.choices?.[0]?.delta?.content || ''
                if (token) {
                  fullText += token
                  callbacks.onToken?.(token)
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }

          callbacks.onComplete?.(fullText)
          return fullText
        }

        const data = await response.json()
        return data.choices?.[0]?.message?.content || ''
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = new Error(`LLM request timed out after ${REQUEST_TIMEOUT_MS}ms`)
      } else if (!lastError || lastError.message !== err.message) {
        lastError = err
      }
      if (attempt < MAX_RETRIES) continue
    }
  }

  throw lastError || new Error('LLM call failed after retries')
}

// ===== Script Catalog Builder =====

/**
 * Build a compact catalog string of all KB entries for the Step 1 prompt.
 * Format: ID | [Category] Title — first 60 chars of content
 */
export function buildScriptCatalog(entries: KnowledgeEntry[]): string {
  const byCategory = new Map<string, KnowledgeEntry[]>()
  for (const e of entries) {
    if (e.deleted) continue
    const list = byCategory.get(e.category) || []
    list.push(e)
    byCategory.set(e.category, list)
  }

  const lines: string[] = []
  for (const [category, catEntries] of byCategory.entries()) {
    lines.push(`\n[${category}]`)
    for (const e of catEntries) {
      const preview = e.content.replace(/\n/g, ' ').slice(0, 80)
      lines.push(`- ID: ${e.id} | ${e.title} — ${preview}...`)
    }
  }
  return lines.join('\n')
}

// ===== Step 1: Understanding Layer =====

export async function runStep1(
  provider: LLMProvider,
  customerMessage: string,
  scriptCatalog: string,
  customPrompt?: string,
  step1Model?: string
): Promise<Step1Result> {
  const promptTemplate = customPrompt || DEFAULT_PROMPT_A
  const prompt = promptTemplate.replace(/{script_catalog}/g, scriptCatalog)

  const result = await callOpenAICompatible(
    provider,
    prompt,
    customerMessage,
    step1Model,
    false,        // no streaming for Step 1
    undefined,    // no callbacks
    500           // Step 1 only outputs a small JSON, 500 tokens is plenty
  )

  // Parse JSON from response (handle markdown code blocks and extra text)
  let jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const fb = jsonStr.indexOf('{')
  const lb = jsonStr.lastIndexOf('}')
  if (fb !== -1 && lb > fb) jsonStr = jsonStr.slice(fb, lb + 1)
  try {
    const parsed = JSON.parse(jsonStr)
    // Ensure matched_ids is always an array
    if (!Array.isArray(parsed.matched_ids)) {
      parsed.matched_ids = []
    }
    return parsed
  } catch {
    throw new Error(`Step 1 JSON parse failed: ${jsonStr.slice(0, 300)}`)
  }
}

// ===== Step 2: Generation Layer =====

export async function runStep2(
  provider: LLMProvider,
  customerMessage: string,
  chineseTranslation: string,
  intent: string,
  matchedEntries: MatchedEntry[],
  targetLanguage: string,
  customPrompt?: string,
  step2Model?: string,
  callbacks?: StreamCallbacks
): Promise<Step2Result> {
  const hasMatch = matchedEntries.length > 0
  const matchedScripts = hasMatch
    ? matchedEntries
        .map((m, i) => `[话术${i + 1}] ${m.entry.title}\n${m.entry.content}`)
        .join('\n\n')
    : '（无匹配话术）'

  const promptTemplate = customPrompt || DEFAULT_PROMPT_B
  const systemPrompt = promptTemplate
    .replace(/{customer_message}/g, customerMessage)
    .replace(/{chinese_translation}/g, chineseTranslation)
    .replace(/{intent}/g, intent)
    .replace(/{matched_scripts}/g, matchedScripts)
    .replace(/{target_language}/g, targetLanguage)
    .replace(/{has_match}/g, String(hasMatch))

  const useStream = !!callbacks?.onToken

  const result = await callOpenAICompatible(
    provider,
    systemPrompt,
    `请根据以上信息，生成${targetLanguage}的客服回复。`,
    step2Model,
    useStream,
    callbacks
  )

  // Parse JSON from response
  const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(jsonStr)
  } catch {
    // If JSON parse fails, try to extract from partial response
    return {
      reply: result,
      chinese: '',
      unmatched: !hasMatch,
    }
  }
}

// ===== Fallback =====

/**
 * Call LLM with a fallback provider if the primary fails.
 */
export async function callWithFallback(
  primary: LLMProvider,
  fallback: LLMProvider | null,
  systemPrompt: string,
  userMessage: string,
  model?: string,
  stream?: boolean,
  callbacks?: StreamCallbacks,
  maxTokensOverride?: number
): Promise<string> {
  try {
    return await callOpenAICompatible(primary, systemPrompt, userMessage, model, stream, callbacks, maxTokensOverride)
  } catch (err) {
    if (fallback) {
      console.warn(`[LLM] Primary failed, trying fallback:`, err)
      return await callOpenAICompatible(fallback, systemPrompt, userMessage, fallback.model, stream, callbacks, maxTokensOverride)
    }
    throw err
  }
}

// ===== Step 0: Triage (Smart Routing) =====

export async function runTriageStep(
  provider: LLMProvider,
  customerMessage: string,
  scriptCatalog: string,
  fallbackProvider?: LLMProvider | null,
  step1Model?: string
): Promise<TriageResult> {
  // Use context builder to assemble memory-aware prompt
  const systemPrompt = await buildTriageContext({
    keywords: [],  // will be populated after first pass; for now empty
    scriptCatalog,
    customerMessage,
  })

  const result = await callWithFallback(
    provider,
    fallbackProvider || null,
    systemPrompt,
    customerMessage,
    step1Model,
    false,
    undefined,
    800  // triage + match combined, slightly more than plain Step 1
  )

  console.log('[Triage] Raw LLM response:', result.slice(0, 500))

  // Robust JSON extraction: strip fences, then find outermost { }
  let jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.matched_ids)) parsed.matched_ids = []
    if (!parsed.triage) {
      parsed.triage = {
        decision: 'HUMAN',
        complexity: 5,
        sentiment: 'neutral',
        risk_level: 'medium',
        reason: 'No triage data in response',
      }
    }
    return parsed as TriageResult
  } catch {
    throw new Error(`Triage JSON parse failed: ${jsonStr.slice(0, 300)}`)
  }
}

// ===== Test Connection =====

export async function testConnection(provider: LLMProvider): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await callOpenAICompatible(
      provider,
      'You are a test assistant.',
      'Reply with exactly: OK',
      provider.model,
      false,
      undefined,
      50
    )
    return { ok: result.length > 0 }
  } catch (err: any) {
    console.error('[testConnection]', err)
    return { ok: false, error: err.message || String(err) }
  }
}

// ===== Extract Scripts from Chat History =====

export interface ExtractedScript {
  title: string
  category: string
  keywords: string[]
  content: string       // 话术模板（中文）
  scenario: string      // 场景描述
  customerExample: string  // 原始客户消息示例
}

export async function generateInitialScripts(
  provider: LLMProvider,
  profile: WorkspaceInitProfile,
  model?: string
): Promise<GeneratedKnowledgeScript[]> {
  const systemPrompt = `你是一位资深跨境电商客服知识库架构师。你的任务是为一个新的 AI 客服工作区初始化第一版可用话术库。

你需要根据品牌、产品领域、销售渠道、地区、履约方式和售后策略，生成一组“首批高频场景话术”。

输出严格 JSON 数组，每个元素：
{
  "title": "话术标题",
  "category": "分类（如：问候类、物流类、退款类、产品问题类、售后类、配件类、安装使用类、其他类）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "content": "中文话术正文，要求专业、可直接用于客服回复，必要信息用 {{变量}} 占位符",
  "scenario": "适用场景描述",
  "customerExample": "客户常见提问示例"
}

生成规则：
- 只输出 JSON 数组，不要输出解释文字
- 先覆盖高频客服场景，不追求过多条目
- 默认生成 12 到 18 条
- 话术内容必须结合提供的产品领域和品牌背景，不能空泛
- 必须显式遵守“禁止承诺项”
- 如果涉及退款、换新、补发、退货，优先遵守提供的售后策略
- 话术正文要适合后续被翻译为多语言客服回复
- 所有话术正文统一用中文输出
- 订单号、金额、日期、链接、产品型号等用变量表示，如 {{订单号}} {{金额}} {{日期}} {{产品型号}} {{链接}}
- 关键词要便于后续意图匹配
- customerExample 用一句代表性客户表达即可

优先覆盖但不限于以下场景：
- 问候和收件确认
- 物流查询 / 延迟送达 / 包裹丢失
- 产品损坏 / 缺件 / 无法使用
- 使用指导 / 安装说明 / 兼容性问题
- 配件咨询
- 退款挽留 / 退货流程 / 换新建议
- 联系平台支持或进一步排查`

  const userPrompt = `请基于以下工作区初始化资料，生成第一版客服话术库：

品牌名称：${profile.brandName || '未提供'}
产品领域：${profile.productDomain || '未提供'}
产品概述：${profile.productSummary || '未提供'}
销售渠道：${profile.salesChannel || '未提供'}
目标市场：${profile.targetMarkets.join('、') || '未提供'}
服务语言：${profile.languages.join('、') || '未提供'}
履约方式：${profile.fulfillmentMode || '未提供'}
售后策略：${profile.supportPolicies || '未提供'}
禁止承诺项：${profile.forbiddenCommitments || '未提供'}
客服语气：${profile.toneStyle || '未提供'}
额外重点场景：${profile.seedScenarios.join('、') || '未提供'}`

  const result = await callOpenAICompatible(
    provider,
    systemPrompt,
    userPrompt,
    model,
    false,
    undefined,
    5000
  )

  let jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const firstBracket = jsonStr.indexOf('[')
  const lastBracket = jsonStr.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    jsonStr = jsonStr.slice(firstBracket, lastBracket + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return []
    return parsed as GeneratedKnowledgeScript[]
  } catch {
    console.error('[generateInitialScripts] JSON parse failed:', jsonStr.slice(0, 400))
    return []
  }
}

export async function extractScriptsFromChat(
  provider: LLMProvider,
  chatHistory: string,
  model?: string
): Promise<ExtractedScript[]> {
  const systemPrompt = `你是一位资深电商客服话术分析师。你的任务是从客服聊天记录中提取可复用的话术模板。

分析步骤：
1. 识别聊天记录中的客户问题和客服回复对
2. 提取客服回复中可复用的部分，归纳为标准化话术模板
3. 将具体信息（订单号、日期、金额、姓名等）替换为 {{变量}} 占位符
4. 为每条话术自动分类并提取关键词

输出严格 JSON 数组，每个元素：
{
  "title": "话术标题（简洁概括场景）",
  "category": "分类（如：退款类、物流类、产品问题类、售后类、配件类、问候类、其他类）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "content": "话术模板正文（中文，具体信息用 {{变量名}} 代替）",
  "scenario": "使用场景描述",
  "customerExample": "客户原始消息摘要"
}

规则：
- 输出 JSON 数组，不要有其他文字
- 如果原始回复是外语，翻译为中文话术模板
- 合并相似的回复为一条话术
- 每条话术应该独立完整可用
- content 中将订单号替换为 {{订单号}}，日期替换为 {{日期}}，金额替换为 {{金额}} 等
- 如果聊天记录过短或无法提取有效话术，返回空数组 []`

  const result = await callOpenAICompatible(
    provider,
    systemPrompt,
    `以下是客服聊天记录，请分析提取话术模板：\n\n${chatHistory}`,
    model,
    false,
    undefined,
    4000
  )

  // Robust JSON extraction
  let jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const firstBracket = jsonStr.indexOf('[')
  const lastBracket = jsonStr.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    jsonStr = jsonStr.slice(firstBracket, lastBracket + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return []
    return parsed as ExtractedScript[]
  } catch {
    console.error('[extractScripts] JSON parse failed:', jsonStr.slice(0, 300))
    return []
  }
}

// ===== Quick Translate (Chinese → Target Language) =====

export async function translateToTarget(
  provider: LLMProvider,
  chineseText: string,
  targetLanguage: string,
  model?: string
): Promise<string> {
  const systemPrompt = `You are a professional e-commerce customer service translator. Translate the following Chinese customer service reply into ${targetLanguage}. 
Rules:
- Keep the same tone, style, and meaning.
- Preserve any {{variables}} as-is.
- Output ONLY the translated text, nothing else.`

  const result = await callOpenAICompatible(
    provider,
    systemPrompt,
    chineseText,
    model,
    false,
    undefined,
    1500
  )
  return result.trim()
}
