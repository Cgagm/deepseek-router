import { describe, it, expect } from 'vitest'
import { SSEProcessor, openAIChunkToAnthropicEvents } from '../src/server/stream.js'

// Helper: collect all events from a sequence of chunks
function processChunks(model: string, chunks: Record<string, unknown>[]): string[] {
  const processor = new SSEProcessor(model)
  const all: string[] = []

  for (const chunk of chunks) {
    const line = `data: ${JSON.stringify(chunk)}\n`
    const events = processor.feed(Buffer.from(line))
    all.push(...events)
  }

  // Send [DONE]
  const doneEvents = processor.feed(Buffer.from('data: [DONE]\n'))
  all.push(...doneEvents)

  const endEvents = processor.end()
  all.push(...endEvents)

  return all
}

// Helper to parse SSE string into { event, data }
function parseSSE(raw: string): { event: string; data: Record<string, unknown> } {
  const lines = raw.trim().split('\n')
  let eventType = ''
  let dataStr = ''
  for (const line of lines) {
    if (line.startsWith('event: ')) eventType = line.slice(7)
    if (line.startsWith('data: ')) dataStr = line.slice(6)
  }
  return { event: eventType, data: JSON.parse(dataStr) }
}

describe('openAIChunkToAnthropicEvents', () => {
  it('emits message_start on first chunk', () => {
    const state = {
      started: false,
      ended: false,
      messageId: '',
      nextBlockIndex: 0,
      textBlockOpen: false,
      textBlockIndex: 0,
      toolBlocks: {},
    }

    const events = openAIChunkToAnthropicEvents(
      { choices: [{ delta: { content: 'Hi' } }] },
      'test-model',
      state,
    )

    const startEvent = parseSSE(events[0]!)
    expect(startEvent.event).toBe('message_start')
    expect(startEvent.data.type).toBe('message_start')
    expect((startEvent.data.message as Record<string, unknown>).model).toBe('test-model')
    expect((startEvent.data.message as Record<string, unknown>).role).toBe('assistant')
  })

  it('emits content_block_start and delta for text', () => {
    // First call with empty state
    const state = {
      started: true, // simulate message_start already sent
      ended: false,
      messageId: 'msg_test',
      nextBlockIndex: 0,
      textBlockOpen: false,
      textBlockIndex: 0,
      toolBlocks: {},
    }

    const events = openAIChunkToAnthropicEvents(
      { choices: [{ delta: { content: 'Hello' } }] },
      'test-model',
      state,
    )

    // First event: content_block_start
    const blockStart = parseSSE(events[0]!)
    expect(blockStart.event).toBe('content_block_start')
    expect(blockStart.data.type).toBe('content_block_start')
    expect((blockStart.data.content_block as Record<string, unknown>).type).toBe('text')

    // Second event: content_block_delta
    const blockDelta = parseSSE(events[1]!)
    expect(blockDelta.event).toBe('content_block_delta')
    expect(blockDelta.data.type).toBe('content_block_delta')
    expect((blockDelta.data.delta as Record<string, unknown>).text).toBe('Hello')
  })

  it('tracks text block index across multiple content chunks', () => {
    const state = {
      started: true,
      ended: false,
      messageId: 'msg_test',
      nextBlockIndex: 0,
      textBlockOpen: false,
      textBlockIndex: 0,
      toolBlocks: {},
    }

    // First text chunk
    openAIChunkToAnthropicEvents(
      { choices: [{ delta: { content: 'Part 1' } }] },
      'test-model',
      state,
    )

    // Close text block
    const closeEvents = openAIChunkToAnthropicEvents(
      { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] },
      'test-model',
      state,
    )

    // Should have content_block_stop with correct index (0)
    const stopEvent = closeEvents.find((e) => e.includes('content_block_stop'))
    expect(stopEvent).toBeDefined()
    expect(stopEvent).toContain('"index":0')
  })

  it('converts finish_reason: stop → end_turn', () => {
    const state = {
      started: true,
      ended: false,
      messageId: 'msg_test',
      nextBlockIndex: 0,
      textBlockOpen: false,
      textBlockIndex: 0,
      toolBlocks: {},
    }

    const events = openAIChunkToAnthropicEvents(
      { choices: [{ finish_reason: 'stop' }] },
      'test-model',
      state,
    )

    const msgDelta = events.find((e) => e.includes('message_delta'))
    expect(msgDelta).toBeDefined()
    expect(msgDelta).toContain('end_turn')

    const msgStop = events.find((e) => e.includes('message_stop'))
    expect(msgStop).toBeDefined()
    expect(state.ended).toBe(true)
  })

  it('handles empty delta gracefully', () => {
    const state = {
      started: true,
      ended: false,
      messageId: 'msg_test',
      nextBlockIndex: 0,
      textBlockOpen: false,
      textBlockIndex: 0,
      toolBlocks: {},
    }

    const events = openAIChunkToAnthropicEvents({ choices: [{ delta: {} }] }, 'test-model', state)

    expect(events).toHaveLength(0)
  })

  it('handles missing choices', () => {
    const state = {
      started: false,
      ended: false,
      messageId: '',
      nextBlockIndex: 0,
      textBlockOpen: false,
      textBlockIndex: 0,
      toolBlocks: {},
    }

    const events = openAIChunkToAnthropicEvents({ choices: [] }, 'test-model', state)

    // No choices, but first chunk still emits message_start
    expect(events).toHaveLength(1)
    expect(events[0]).toContain('message_start')
  })
})

describe('SSEProcessor', () => {
  describe('full stream lifecycle', () => {
    it('emits message_start → content blocks → message_delta → message_stop', () => {
      const processor = new SSEProcessor('test-model')

      // Chunk 1: text content
      const events1 = processor.feed(
        Buffer.from('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'),
      )

      const hasStart = events1.some((e) => e.includes('message_start'))
      const hasBlockStart = events1.some((e) => e.includes('content_block_start'))
      const hasDelta = events1.some((e) => e.includes('content_block_delta'))
      expect(hasStart).toBe(true)
      expect(hasBlockStart).toBe(true)
      expect(hasDelta).toBe(true)

      // Chunk 2: finish
      const events2 = processor.feed(
        Buffer.from(
          'data: {"choices":[{"finish_reason":"stop"}],"usage":{"completion_tokens":5}}\n',
        ),
      )

      const hasMsgDelta = events2.some((e) => e.includes('message_delta'))
      const hasMsgStop = events2.some((e) => e.includes('message_stop'))
      expect(hasMsgDelta).toBe(true)
      expect(hasMsgStop).toBe(true)
    })
  })

  describe('[DONE] handling', () => {
    it('emits message_stop on [DONE] if not already ended', () => {
      const processor = new SSEProcessor('test-model')

      // Send one chunk so message_start fires
      processor.feed(Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))

      const events = processor.feed(Buffer.from('data: [DONE]\n'))
      const hasStop = events.some((e) => e.includes('message_stop'))
      expect(hasStop).toBe(true)
    })

    it('does not double-emit message_stop on [DONE] after finish_reason', () => {
      const processor = new SSEProcessor('test-model')

      processor.feed(Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))
      processor.feed(Buffer.from('data: {"choices":[{"finish_reason":"stop"}]}\n'))

      const events = processor.feed(Buffer.from('data: [DONE]\n'))
      const stopEvents = events.filter((e) => e.includes('message_stop'))
      expect(stopEvents).toHaveLength(0)
    })
  })

  describe('buffer handling', () => {
    it('handles partial lines across chunks', () => {
      const processor = new SSEProcessor('test-model')

      // Split a single SSE line across two chunks
      const part1 = 'data: {"choices":[{"d'
      const part2 = 'elta":{"content":"Hi"}}]}\n'

      const events1 = processor.feed(Buffer.from(part1))
      expect(events1).toHaveLength(0)

      const events2 = processor.feed(Buffer.from(part2))
      const hasStart = events2.some((e) => e.includes('message_start'))
      expect(hasStart).toBe(true)
    })

    it('handles multiple lines in a single chunk', () => {
      const processor = new SSEProcessor('test-model')

      const events = processor.feed(
        Buffer.from(
          'data: {"choices":[{"delta":{"content":"A"}}]}\n' +
            'data: {"choices":[{"delta":{"content":"B"}}]}\n',
        ),
      )

      const deltas = events.filter((e) => e.includes('content_block_delta'))
      // Should have two deltas (both within same text block)
      expect(deltas.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('end() method', () => {
    it('emits message_stop if stream was started but not ended', () => {
      const processor = new SSEProcessor('test-model')
      processor.feed(Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))

      const events = processor.end()
      const hasStop = events.some((e) => e.includes('message_stop'))
      expect(hasStop).toBe(true)
    })

    it('returns empty if never started', () => {
      const processor = new SSEProcessor('test-model')
      const events = processor.end()
      expect(events).toHaveLength(0)
    })

    it('does not double-emit if already ended', () => {
      const processor = new SSEProcessor('test-model')
      processor.feed(Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))
      processor.feed(Buffer.from('data: [DONE]\n'))
      const events = processor.end()
      expect(events).toHaveLength(0)
    })
  })

  describe('reset()', () => {
    it('clears state for reuse', () => {
      const processor = new SSEProcessor('old-model')
      processor.feed(Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))
      processor.feed(Buffer.from('data: [DONE]\n'))

      processor.reset('new-model')

      const events = processor.feed(
        Buffer.from('data: {"choices":[{"delta":{"content":"Fresh"}}]}\n'),
      )
      expect(events.some((e) => e.includes('message_start'))).toBe(true)
      expect(events.some((e) => e.includes('Fresh'))).toBe(true)
    })
  })

  describe('tool_calls in stream', () => {
    it('emits content_block_start and delta for tool_calls', () => {
      const processor = new SSEProcessor('test-model')

      const events = processor.feed(
        Buffer.from(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_001","function":{"name":"search","arguments":"{\\"query\\""}}]}}]}\n',
        ),
      )

      const blockStart = events.find((e) => e.includes('"type":"tool_use"'))
      expect(blockStart).toBeDefined()

      const delta = events.find((e) => e.includes('input_json_delta'))
      expect(delta).toBeDefined()
    })
  })

  describe('non-data lines', () => {
    it('ignores non-data SSE lines', () => {
      const processor = new SSEProcessor('test-model')

      const events = processor.feed(
        Buffer.from(':keepalive\n' + 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n'),
      )

      expect(events.some((e) => e.includes('message_start'))).toBe(true)
    })
  })
})
