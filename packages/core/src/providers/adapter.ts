import type { AnthropicRequest } from '../types/index.js'
import type { ProviderConfig } from '../types/index.js'

// ── Anthropic → OpenAI request ──
export function anthropicToOpenAI(
  body: AnthropicRequest,
  provider: ProviderConfig,
): { path: string; headers: Record<string, string>; body: Buffer } {
  const model = provider.models[body.model] ?? body.model

  const messages: Record<string, unknown>[] = []
  const openai: Record<string, unknown> = {
    model,
    messages,
    max_tokens: body.max_tokens ?? 4096,
    stream: body.stream ?? false,
  }

  if (body.temperature !== undefined) openai.temperature = body.temperature
  if (body.top_p !== undefined) openai.top_p = body.top_p
  if (body.top_k !== undefined) openai.top_k = body.top_k

  // System prompt → messages[0]
  if (body.system) {
    messages.push({ role: 'system', content: body.system })
  }

  // Messages conversion with tool_use / tool_result handling
  for (const msg of body.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content })
    } else if (Array.isArray(msg.content)) {
      const texts: string[] = []
      const toolCalls: Record<string, unknown>[] = []
      const toolResults: Record<string, unknown>[] = []

      for (const block of msg.content) {
        if (block.type === 'text') {
          texts.push(block.text)
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          })
        } else if (block.type === 'tool_result') {
          const content =
            typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          toolResults.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content,
          })
        }
      }

      if (msg.role === 'assistant' && toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: texts.join('') || null,
          tool_calls: toolCalls,
        })
      } else if (texts.length > 0 || toolResults.length === 0) {
        messages.push({ role: msg.role, content: texts.join('') })
      }

      for (const tr of toolResults) {
        messages.push(tr)
      }
    }
  }

  // Tools conversion
  if (body.tools && body.tools.length > 0) {
    openai.tools = body.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.input_schema ?? {},
      },
    }))

    if (body.tool_choice) {
      if (typeof body.tool_choice === 'string') {
        openai.tool_choice = body.tool_choice
      } else if (body.tool_choice.type) {
        const tcType = body.tool_choice.type
        if (tcType === 'auto') openai.tool_choice = 'auto'
        else if (tcType === 'any') openai.tool_choice = 'required'
        else if (tcType === 'tool')
          openai.tool_choice = {
            type: 'function',
            function: { name: body.tool_choice.name },
          }
      }
    }
  }

  // Stop sequences
  if (body.stop_sequences && body.stop_sequences.length > 0) {
    openai.stop = body.stop_sequences
  }

  const url = new URL(provider.endpoint)
  const buf = Buffer.from(JSON.stringify(openai), 'utf-8')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': String(buf.length),
  }

  // Auth
  switch (provider.authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${provider.apiKey}`
      break
    case 'x-api-key':
      headers['x-api-key'] = provider.apiKey
      break
    case 'api-key':
      headers['api-key'] = provider.apiKey
      break
  }

  // Extra headers
  if (provider.headers) {
    Object.assign(headers, provider.headers)
  }

  return { path: url.pathname + url.search, headers, body: buf }
}

// ── Prepare Anthropic request for native-Anthropic providers ──
export function prepareAnthropicRequest(
  body: AnthropicRequest,
  provider: ProviderConfig,
): {
  path: string
  headers: Record<string, string>
  body: Buffer
} {
  const model = provider.models[body.model] ?? body.model
  const payload = { ...body, model }
  const url = new URL(provider.endpoint)
  const buf = Buffer.from(JSON.stringify(payload), 'utf-8')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': String(buf.length),
  }

  switch (provider.authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${provider.apiKey}`
      break
    case 'x-api-key':
      headers['x-api-key'] = provider.apiKey
      headers['anthropic-version'] = '2023-06-01'
      break
    default:
      headers['x-api-key'] = provider.apiKey
      headers['anthropic-version'] = '2023-06-01'
  }

  if (provider.headers) {
    Object.assign(headers, provider.headers)
  }

  return { path: url.pathname + url.search, headers, body: buf }
}

// ── OpenAI non-streaming response → Anthropic ──
export function openAIToAnthropic(
  data: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const choice = (data.choices as Record<string, unknown>[])?.[0]
  if (!choice) {
    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: '' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    }
  }

  const message = choice.message as Record<string, unknown> | undefined
  const content: Record<string, unknown>[] = []

  if (message?.content) {
    content.push({ type: 'text', text: message.content })
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls as Record<string, unknown>[]) {
      let input = {}
      try {
        input = JSON.parse((tc.function as Record<string, string>)?.arguments ?? '{}')
      } catch {
        input = {}
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: (tc.function as Record<string, string>)?.name,
        input,
      })
    }
  }

  const finishReason = choice.finish_reason as string
  const finishMap: Record<string, string> = {
    stop: 'end_turn',
    length: 'max_tokens',
    tool_calls: 'tool_use',
    content_filter: 'end_turn',
  }

  const usage = data.usage as Record<string, number> | undefined

  return {
    id: `msg_${data.id ?? Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: (data.model as string) ?? model,
    stop_reason: finishMap[finishReason] ?? finishReason ?? 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  }
}
