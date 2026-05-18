import { createLogger } from '../observability/logger.js'

const logger = createLogger('stream')

interface StreamState {
  started: boolean
  ended: boolean
  messageId: string
  nextBlockIndex: number
  textBlockOpen: boolean
  textBlockIndex: number
  toolBlocks: Record<
    number,
    {
      id: string
      name: string
      started: boolean
      stopped: boolean
      blockIndex: number
    }
  >
}

function createStreamState(): StreamState {
  return {
    started: false,
    ended: false,
    messageId: '',
    nextBlockIndex: 0,
    textBlockOpen: false,
    textBlockIndex: 0,
    toolBlocks: {},
  }
}

/**
 * Convert OpenAI SSE chunks to Anthropic SSE events.
 * Pure function — no side effects, returns array of SSE strings.
 */
export function openAIChunkToAnthropicEvents(
  chunk: Record<string, unknown>,
  model: string,
  state: StreamState,
): string[] {
  const events: string[] = []

  // First chunk: emit message_start
  if (!state.started) {
    state.started = true
    state.messageId = `msg_${Date.now()}`
    events.push(
      `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: state.messageId, type: 'message', role: 'assistant', model, content: [], usage: { input_tokens: 0, output_tokens: 0 } } })}\n`,
    )
  }

  const choice = (chunk.choices as Array<Record<string, unknown>>)?.[0]
  if (!choice) return events

  const delta = (choice.delta ?? {}) as Record<string, unknown>

  // ── Text content ──
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    if (!state.textBlockOpen) {
      state.textBlockOpen = true
      state.textBlockIndex = state.nextBlockIndex++
      events.push(
        `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: state.textBlockIndex, content_block: { type: 'text', text: '' } })}\n`,
      )
    }
    events.push(
      `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: state.textBlockIndex, delta: { type: 'text_delta', text: delta.content } })}\n`,
    )
  }

  // ── Tool calls ──
  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
      const idx = (tc.index as number) ?? 0
      if (!state.toolBlocks[idx]) {
        state.toolBlocks[idx] = {
          id: (tc.id as string) ?? `toolu_${Date.now()}`,
          name: '',
          started: false,
          stopped: false,
          blockIndex: state.nextBlockIndex++,
        }
      }
      const tb = state.toolBlocks[idx]!

      if (tc.id && typeof tc.id === 'string') tb.id = tc.id
      const func = tc.function as Record<string, string> | undefined
      if (func?.name) tb.name = func.name

      if (!tb.started) {
        tb.started = true
        events.push(
          `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: tb.blockIndex, content_block: { type: 'tool_use', id: tb.id, name: tb.name, input: {} } })}\n`,
        )
      }

      if (func?.arguments) {
        events.push(
          `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: tb.blockIndex, delta: { type: 'input_json_delta', partial_json: func.arguments } })}\n`,
        )
      }
    }
  }

  // ── Finish ──
  if (choice.finish_reason) {
    // Close text block
    if (state.textBlockOpen) {
      events.push(
        `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: state.textBlockIndex })}\n`,
      )
      state.textBlockOpen = false
    }

    // Close tool blocks
    for (const idx of Object.keys(state.toolBlocks).map(Number)) {
      const tb = state.toolBlocks[idx]!
      if (tb.started && !tb.stopped) {
        tb.stopped = true
        events.push(
          `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: tb.blockIndex })}\n`,
        )
      }
    }

    const finishMap: Record<string, string> = {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
      content_filter: 'end_turn',
    }
    const stopReason =
      finishMap[choice.finish_reason as string] ?? (choice.finish_reason as string) ?? 'end_turn'

    const usage = chunk.usage as Record<string, number> | undefined

    events.push(
      `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: usage?.completion_tokens ?? 0 } })}\n`,
    )
    events.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n`)

    state.ended = true
  }

  return events
}

/**
 * Process a raw SSE data line from OpenAI into Anthropic SSE events.
 * Handles buffer accumulation across chunks.
 */
export class SSEProcessor {
  private buffer = ''
  private state = createStreamState()
  private model: string

  constructor(model: string) {
    this.model = model
  }

  /** Feed a chunk of raw SSE data. Returns converted Anthropic SSE strings. */
  feed(chunk: Buffer): string[] {
    const output: string[] = []
    this.buffer += chunk.toString()

    const lines = this.buffer.split('\n')
    // Last element may be incomplete, keep in buffer
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      const dataStr = line.slice(6).trim()
      if (dataStr === '[DONE]') {
        if (this.state.started && !this.state.ended) {
          this.state.ended = true
          output.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n`)
        }
        continue
      }

      try {
        const chunk = JSON.parse(dataStr)
        const events = openAIChunkToAnthropicEvents(chunk, this.model, this.state)
        output.push(...events)
      } catch {
        logger.debug({ dataStr }, 'Failed to parse SSE chunk')
      }
    }

    return output
  }

  /** Ensure stream is properly closed. Returns any final events. */
  end(): string[] {
    if (this.state.started && !this.state.ended) {
      this.state.ended = true
      return [`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n`]
    }
    return []
  }

  /** Reset for reuse */
  reset(model?: string): void {
    this.buffer = ''
    this.state = createStreamState()
    if (model) this.model = model
  }
}
