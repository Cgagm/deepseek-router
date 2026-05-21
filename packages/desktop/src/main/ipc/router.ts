import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { getDatabase } from '../database/schema'

// ===== Provider configurations =====
interface ProviderDef {
  name: string
  baseURL: string
  defaultModel: string
  models: string[]
}

const PROVIDERS: Record<string, ProviderDef> = {
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  kimi: {
    name: 'Kimi',
    baseURL: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-128k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  qwen: {
    name: '千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-max',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  zhipu: {
    name: '智谱GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-flash'],
  },
}

// ===== Task → model routing =====
interface ModelSelection {
  provider: string
  model: string
}

function detectTaskType(messages: { role: string; content: string }[]): string {
  const userMsgs = messages.filter(m => m.role === 'user')
  if (!userMsgs.length) return 'default'
  const lastMsg = userMsgs[userMsgs.length - 1].content.toLowerCase()

  const patterns: [string, RegExp[]][] = [
    ['code', [/写.*(代码|程序|脚本|爬虫|函数|bug)/, /\b(code|python|javascript|react|api)\b/i]],
    ['email', [/写.*(邮件|email)/, /回复.*邮件/]],
    ['report', [/周报|月报|总结报告|工作汇报|会议纪要/]],
    ['contract', [/合同|条款|法律|合规|协议|风险/]],
    ['translate', [/翻译|translate|英语|日语|韩语|外语/]],
    ['data', [/分析.*(数据|表格|excel|报表|趋势)/, /统计/]],
    ['summary', [/总结|概括|归纳|摘要|summarize|要点/]],
    ['write', [/写.*(文章|文案|作文|方案|内容)/, /生成.*(内容|文案)/]],
    ['table', [/表格|excel|xlsx|csv|图表/]],
    ['ppt', [/ppt|幻灯片|演示|presentation/]],
    ['paper', [/论文|学术|文献|研究/]],
  ]

  for (const [type, pats] of patterns) {
    if (pats.some(p => p.test(lastMsg))) return type
  }
  return 'default'
}

function selectModel(taskType: string): ModelSelection {
  const map: Record<string, ModelSelection> = {
    code: { provider: 'deepseek', model: 'deepseek-chat' },
    email: { provider: 'deepseek', model: 'deepseek-chat' },
    report: { provider: 'deepseek', model: 'deepseek-chat' },
    write: { provider: 'deepseek', model: 'deepseek-chat' },

    contract: { provider: 'kimi', model: 'moonshot-v1-128k' },
    paper: { provider: 'kimi', model: 'moonshot-v1-128k' },

    translate: { provider: 'qwen', model: 'qwen-max' },

    data: { provider: 'zhipu', model: 'glm-4-plus' },
    table: { provider: 'zhipu', model: 'glm-4-plus' },

    summary: { provider: 'deepseek', model: 'deepseek-chat' },
    ppt: { provider: 'deepseek', model: 'deepseek-chat' },

    default: { provider: 'deepseek', model: 'deepseek-chat' },
  }
  return map[taskType] || map['default']
}

// ===== API call helpers =====

interface ChatParams {
  messages: { role: string; content: string }[]
  provider?: string
  model?: string
  stream?: boolean
}

interface StreamChunk {
  choices?: { delta?: { content?: string }; index: number }[]
}

async function fetchStream(
  provider: ProviderDef,
  model: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(provider.baseURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: 4096,
    }),
    signal,
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`${provider.name} API 错误 (${response.status}): ${errText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue

      try {
        const parsed: StreamChunk = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          fullContent += content
          onChunk(content)
        }
      } catch {
        // Skip unparseable chunks
      }
    }
  }

  return fullContent
}

async function fetchNonStream(
  provider: ProviderDef,
  model: string,
  messages: { role: string; content: string }[],
  apiKey: string,
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number } }> {
  const response = await fetch(provider.baseURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`${provider.name} API 错误 (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
    },
  }
}

// ===== API Key management (from settings) =====
function getApiKey(provider: string, ipcEvent: IpcMainInvokeEvent): string | null {
  // Try environment variable first
  const envKey = process.env[`CC_${provider.toUpperCase()}_API_KEY`]
  if (envKey) return envKey

  // For token/buyout users, keys could be bundled
  // For now, check settings via storage
  try {
    const db = getDatabase()
    const result = db.exec("SELECT value FROM settings WHERE key = 'settings'")
    if (result.length && result[0].values.length) {
      const settings = JSON.parse(result[0].values[0][0] as string)
      return settings.apiKeys?.[provider] || null
    }
  } catch { /* not available */ }

  return null
}

// ===== IPC Setup =====

export function setupRouterIPC(): void {
  const activeStreams = new Map<string, AbortController>()

  ipcMain.handle('chat:send', async (event: IpcMainInvokeEvent, params: ChatParams) => {
    const { messages, provider: overrideProvider, model: overrideModel, stream = true } = params

    // Auto-detect task and select best model
    const taskType = detectTaskType(messages)
    const selection = overrideProvider && overrideModel
      ? { provider: overrideProvider, model: overrideModel }
      : selectModel(taskType)

    const providerDef = PROVIDERS[selection.provider]
    if (!providerDef) {
      throw new Error(`未知的 AI 提供商: ${selection.provider}`)
    }

    const apiKey = getApiKey(selection.provider, event)
    if (!apiKey) {
      // Fallback: try next available provider
      throw new Error(
        `未配置 ${providerDef.name} 的 API Key。请在设置中填写 API Key，或购买 Token 套餐直接使用。`
      )
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    if (stream) {
      const controller = new AbortController()
      activeStreams.set(requestId, controller)

      // Start streaming in background
      ;(async () => {
        try {
          const sender = event.sender
          const fullContent = await fetchStream(
            providerDef,
            selection.model,
            messages,
            apiKey,
            (chunk) => sender.send('chat:streamChunk', { requestId, chunk }),
            controller.signal,
          )

          sender.send('chat:streamDone', {
            requestId,
            message: {
              id: `msg_${Date.now()}`,
              role: 'assistant',
              content: fullContent,
              timestamp: Date.now(),
              provider: selection.provider,
              model: selection.model,
            }
          })
        } catch (err: any) {
          if (!controller.signal.aborted) {
            event.sender.send('chat:streamError', { requestId, error: err.message })
          }
        } finally {
          activeStreams.delete(requestId)
        }
      })()

      return {
        id: requestId,
        content: '',
        provider: selection.provider,
        model: selection.model,
        tokens: { prompt: 0, completion: 0 },
        streaming: true,
      }
    } else {
      const result = await fetchNonStream(providerDef, selection.model, messages, apiKey)
      return {
        id: `msg_${Date.now()}`,
        content: result.content,
        provider: selection.provider,
        model: selection.model,
        tokens: {
          prompt: result.usage.prompt_tokens,
          completion: result.usage.completion_tokens,
        },
      }
    }
  })

  ipcMain.handle('chat:abort', (_event, requestId: string) => {
    const controller = activeStreams.get(requestId)
    if (controller) {
      controller.abort()
      activeStreams.delete(requestId)
    }
  })
}
