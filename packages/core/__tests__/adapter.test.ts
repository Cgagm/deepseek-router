import { describe, it, expect } from 'vitest'
import {
  anthropicToOpenAI,
  prepareAnthropicRequest,
  openAIToAnthropic,
} from '../src/providers/adapter.js'
import type { ProviderConfig, AnthropicRequest } from '../src/types/index.js'

const openaiProvider: ProviderConfig = {
  name: 'tencent',
  displayName: 'Tencent Hunyuan',
  endpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  apiKey: 'sk-test-key',
  format: 'openai',
  authType: 'bearer',
  models: { 'deepseek-v4-flash': 'hunyuan-lite' },
  weight: 5,
  timeoutMs: 120000,
  maxRetries: 2,
}

const anthropicProvider: ProviderConfig = {
  name: 'deepseek',
  displayName: 'DeepSeek',
  endpoint: 'https://api.deepseek.com/anthropic/messages',
  apiKey: 'sk-deepseek-key',
  format: 'anthropic',
  authType: 'x-api-key',
  models: { 'deepseek-v4-flash': 'deepseek-chat' },
  weight: 5,
  timeoutMs: 120000,
  maxRetries: 2,
}

function makeRequest(overrides?: Partial<AnthropicRequest>): AnthropicRequest {
  return {
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 4096,
    stream: false,
    ...overrides,
  }
}

describe('anthropicToOpenAI', () => {
  describe('basic conversion', () => {
    it('converts model name using provider mapping', () => {
      const result = anthropicToOpenAI(makeRequest(), openaiProvider)
      const body = JSON.parse(result.body.toString())
      expect(body.model).toBe('hunyuan-lite')
    })

    it('uses original model if no mapping exists', () => {
      const result = anthropicToOpenAI(makeRequest({ model: 'unknown-model' }), openaiProvider)
      const body = JSON.parse(result.body.toString())
      expect(body.model).toBe('unknown-model')
    })

    it('passes through max_tokens', () => {
      const result = anthropicToOpenAI(makeRequest({ max_tokens: 1024 }), openaiProvider)
      const body = JSON.parse(result.body.toString())
      expect(body.max_tokens).toBe(1024)
    })

    it('defaults max_tokens to 4096', () => {
      const req = makeRequest()
      delete (req as Record<string, unknown>).max_tokens
      const result = anthropicToOpenAI(req, openaiProvider)
      const body = JSON.parse(result.body.toString())
      expect(body.max_tokens).toBe(4096)
    })

    it('passes stream flag', () => {
      const result = anthropicToOpenAI(makeRequest({ stream: true }), openaiProvider)
      const body = JSON.parse(result.body.toString())
      expect(body.stream).toBe(true)
    })

    it('passes temperature, top_p, top_k', () => {
      const result = anthropicToOpenAI(
        makeRequest({ temperature: 0.7, top_p: 0.9, top_k: 50 }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.temperature).toBe(0.7)
      expect(body.top_p).toBe(0.9)
      expect(body.top_k).toBe(50)
    })

    it('omits undefined optional fields', () => {
      const result = anthropicToOpenAI(makeRequest(), openaiProvider)
      const body = JSON.parse(result.body.toString())
      expect(body).not.toHaveProperty('temperature')
    })
  })

  describe('system prompt', () => {
    it('adds system message as first message', () => {
      const result = anthropicToOpenAI(
        makeRequest({ system: 'You are a helpful assistant.' }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' })
    })
  })

  describe('message conversion', () => {
    it('passes simple string content messages through', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.messages).toHaveLength(2)
      expect(body.messages[0]?.role).toBe('user')
      expect(body.messages[0]?.content).toBe('Hello')
      expect(body.messages[1]?.role).toBe('assistant')
      expect(body.messages[1]?.content).toBe('Hi there!')
    })
  })

  describe('tool_use conversion', () => {
    it('converts tool_use blocks to OpenAI tool_calls', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          messages: [
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Let me search.' },
                {
                  type: 'tool_use',
                  id: 'toolu_001',
                  name: 'search',
                  input: { query: 'weather' },
                },
              ],
            },
          ],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      const assistantMsg = body.messages[0]
      expect(assistantMsg.role).toBe('assistant')
      expect(assistantMsg.content).toBe('Let me search.')
      expect(assistantMsg.tool_calls).toHaveLength(1)
      expect(assistantMsg.tool_calls[0].id).toBe('toolu_001')
      expect(assistantMsg.tool_calls[0].type).toBe('function')
      expect(assistantMsg.tool_calls[0].function.name).toBe('search')
      expect(JSON.parse(assistantMsg.tool_calls[0].function.arguments)).toEqual({
        query: 'weather',
      })
    })

    it('handles tool_use without text', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_002',
                  name: 'get_weather',
                  input: { city: 'Beijing' },
                },
              ],
            },
          ],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      const assistantMsg = body.messages[0]
      expect(assistantMsg.content).toBeNull()
      expect(assistantMsg.tool_calls).toHaveLength(1)
    })
  })

  describe('tool_result conversion', () => {
    it('converts tool_result to tool role message', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_001',
                  content: 'Sunny, 22°C',
                },
              ],
            },
          ],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.messages).toHaveLength(1)
      expect(body.messages[0].role).toBe('tool')
      expect(body.messages[0].tool_call_id).toBe('toolu_001')
      expect(body.messages[0].content).toBe('Sunny, 22°C')
    })

    it('stringifies non-string tool_result content', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_003',
                  content: { result: 'ok' } as unknown as string,
                },
              ],
            },
          ],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.messages[0].content).toBe('{"result":"ok"}')
    })
  })

  describe('tools definition', () => {
    it('converts Anthropic tools to OpenAI functions', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          tools: [
            {
              name: 'search',
              description: 'Search the web',
              input_schema: {
                type: 'object',
                properties: { query: { type: 'string' } },
              },
            },
          ],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.tools).toHaveLength(1)
      expect(body.tools[0].type).toBe('function')
      expect(body.tools[0].function.name).toBe('search')
      expect(body.tools[0].function.description).toBe('Search the web')
    })

    it('converts tool_choice auto', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          tool_choice: { type: 'auto' },
          tools: [{ name: 'search', input_schema: {} }],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.tool_choice).toBe('auto')
    })

    it('converts tool_choice any to required', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          tool_choice: { type: 'any' },
          tools: [{ name: 'search', input_schema: {} }],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.tool_choice).toBe('required')
    })

    it('converts tool_choice tool with name', () => {
      const result = anthropicToOpenAI(
        makeRequest({
          tool_choice: { type: 'tool', name: 'search' },
          tools: [{ name: 'search', input_schema: {} }],
        }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.tool_choice).toEqual({
        type: 'function',
        function: { name: 'search' },
      })
    })
  })

  describe('stop sequences', () => {
    it('maps stop_sequences to stop', () => {
      const result = anthropicToOpenAI(
        makeRequest({ stop_sequences: ['END', 'STOP'] }),
        openaiProvider,
      )
      const body = JSON.parse(result.body.toString())
      expect(body.stop).toEqual(['END', 'STOP'])
    })
  })

  describe('auth headers', () => {
    it('uses Bearer token for authType=bearer', () => {
      const result = anthropicToOpenAI(makeRequest(), openaiProvider)
      expect(result.headers['Authorization']).toBe('Bearer sk-test-key')
    })

    it('uses x-api-key header for authType=x-api-key', () => {
      const provider: ProviderConfig = { ...openaiProvider, authType: 'x-api-key' }
      const result = anthropicToOpenAI(makeRequest(), provider)
      expect(result.headers['x-api-key']).toBe('sk-test-key')
    })

    it('uses api-key header for authType=api-key', () => {
      const provider: ProviderConfig = { ...openaiProvider, authType: 'api-key' }
      const result = anthropicToOpenAI(makeRequest(), provider)
      expect(result.headers['api-key']).toBe('sk-test-key')
    })
  })

  describe('extra headers', () => {
    it('includes provider-specific headers', () => {
      const provider: ProviderConfig = {
        ...openaiProvider,
        headers: { 'X-Custom': 'value' },
      }
      const result = anthropicToOpenAI(makeRequest(), provider)
      expect(result.headers['X-Custom']).toBe('value')
    })
  })

  describe('path', () => {
    it('extracts path from provider endpoint', () => {
      const result = anthropicToOpenAI(makeRequest(), openaiProvider)
      expect(result.path).toBe('/v1/chat/completions')
    })
  })
})

describe('prepareAnthropicRequest', () => {
  it('maps model name', () => {
    const result = prepareAnthropicRequest(makeRequest(), anthropicProvider)
    const body = JSON.parse(result.body.toString())
    expect(body.model).toBe('deepseek-chat')
  })

  it('passes through all Anthropic fields', () => {
    const req = makeRequest({
      system: 'You are helpful.',
      temperature: 0.5,
      tools: [{ name: 'search', input_schema: {} }],
    })
    const result = prepareAnthropicRequest(req, anthropicProvider)
    const body = JSON.parse(result.body.toString())
    expect(body.system).toBe('You are helpful.')
    expect(body.temperature).toBe(0.5)
    expect(body.tools).toHaveLength(1)
  })

  it('sets x-api-key and anthropic-version for anthropic providers', () => {
    const result = prepareAnthropicRequest(makeRequest(), anthropicProvider)
    expect(result.headers['x-api-key']).toBe('sk-deepseek-key')
    expect(result.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('uses Bearer token for authType=bearer', () => {
    const provider: ProviderConfig = { ...anthropicProvider, authType: 'bearer' }
    const result = prepareAnthropicRequest(makeRequest(), provider)
    expect(result.headers['Authorization']).toBe('Bearer sk-deepseek-key')
  })
})

describe('openAIToAnthropic', () => {
  it('converts text response', () => {
    const result = openAIToAnthropic(
      {
        id: 'chatcmpl-123',
        model: 'hunyuan-lite',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      },
      'deepseek-v4-flash',
    )

    expect(result.id).toContain('chatcmpl-123')
    expect(result.type).toBe('message')
    expect(result.role).toBe('assistant')
    expect(result.model).toBe('hunyuan-lite')
    expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }])
    expect(result.stop_reason).toBe('end_turn')
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 })
  })

  it('converts tool_calls to tool_use blocks', () => {
    const result = openAIToAnthropic(
      {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_abc',
                  type: 'function',
                  function: { name: 'search', arguments: '{"query":"weather"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      },
      'deepseek-v4-flash',
    )

    const contents = result.content as Array<Record<string, unknown>>
    expect(contents).toHaveLength(1)
    expect(contents[0]?.type).toBe('tool_use')
    expect(contents[0]?.id).toBe('call_abc')
    expect(contents[0]?.name).toBe('search')
    expect(contents[0]?.input).toEqual({ query: 'weather' })
    expect(result.stop_reason).toBe('tool_use')
  })

  it('handles empty choices gracefully', () => {
    const result = openAIToAnthropic({ choices: [] }, 'deepseek-v4-flash')
    expect(result.content).toEqual([{ type: 'text', text: '' }])
    expect(result.stop_reason).toBe('end_turn')
  })

  it('handles missing usage', () => {
    const result = openAIToAnthropic(
      { choices: [{ message: { content: 'ok' } }] },
      'deepseek-v4-flash',
    )
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 })
  })

  it('maps finish_reason: length → max_tokens', () => {
    const result = openAIToAnthropic(
      { choices: [{ message: { content: 'truncated' }, finish_reason: 'length' }] },
      'deepseek-v4-flash',
    )
    expect(result.stop_reason).toBe('max_tokens')
  })

  it('handles malformed tool_calls arguments', () => {
    const result = openAIToAnthropic(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_bad',
                  function: { name: 'test', arguments: 'not json{' },
                },
              ],
            },
          },
        ],
      },
      'deepseek-v4-flash',
    )
    const contents = result.content as Array<Record<string, unknown>>
    expect(contents[0]?.input).toEqual({})
  })
})
