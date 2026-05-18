import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { EventEmitter } from 'node:events'

const { mockRequestImpl } = vi.hoisted(() => ({
  mockRequestImpl: vi.fn(),
}))

vi.mock('node:https', () => ({
  default: { request: mockRequestImpl },
  request: mockRequestImpl,
}))

import { createServer } from '../src/server/server.js'
import type { ProxyServerOptions } from '../src/server/server.js'
import { FailoverRouter } from '../src/routing/failover.js'
import { CircuitBreaker } from '../src/routing/circuit-breaker.js'
import { MetricsCollector } from '../src/observability/metrics.js'
import type { ProviderConfig, RouterConfig } from '../src/types/index.js'

class FakeIncomingMessage extends EventEmitter {
  statusCode: number
  headers: Record<string, string>
  constructor(statusCode: number, headers: Record<string, string> = {}) {
    super()
    this.statusCode = statusCode
    this.headers = headers
  }
}

class FakeClientRequest extends EventEmitter {
  writen = false
  ended = false
  writtenData: Buffer[] = []

  write(data: Buffer): boolean {
    this.writtenData.push(data)
    this.writen = true
    return true
  }

  end(): void {
    this.ended = true
  }
}

function buildTestOptions(): ProxyServerOptions {
  const cb = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 30000,
    halfOpenMaxRequests: 2,
  })

  const testProvider: ProviderConfig = {
    name: 'mock-provider',
    displayName: 'Mock Provider',
    endpoint: 'https://mock.example.com/v1/chat/completions',
    apiKey: 'sk-mock-key',
    format: 'openai',
    authType: 'bearer',
    models: {},
    timeoutMs: 5000,
    maxRetries: 1,
  }

  const testConfig: RouterConfig = {
    providerOrder: ['mock-provider'],
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxRequests: 2 },
    globalTimeoutMs: 10000,
    defaultModel: 'test-model',
    port: 0,
    logLevel: 'error',
  }

  const router = new FailoverRouter([testProvider], testConfig, cb)
  const metrics = new MetricsCollector(cb)

  return {
    port: 0,
    router,
    circuitBreaker: cb,
    metrics,
    version: '2.0.0-test',
  }
}

function makeRequest(
  port: number,
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'any-value',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c: Buffer) => (data += c.toString()))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data })
        })
      },
    )
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

describe('Server Unit (mocked https)', () => {
  let server: http.Server
  let port: number

  beforeAll(async () => {
    const options = buildTestOptions()
    server = createServer(options)

    await new Promise<void>((resolve) => {
      server.on('listening', () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') port = addr.port
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  describe('POST /v1/messages non-streaming success', () => {
    it('returns 200 with Anthropic-format response for OpenAI provider', async () => {
      const fakeRes = new FakeIncomingMessage(200, {
        'content-type': 'application/json',
      })
      const fakeReq = new FakeClientRequest()

      mockRequestImpl.mockImplementation(
        (_options: unknown, callback: (res: FakeIncomingMessage) => void): FakeClientRequest => {
          // Schedule the response asynchronously
          setImmediate(() => {
            callback(fakeRes)
            // Emit the response body
            fakeRes.emit(
              'data',
              Buffer.from(
                JSON.stringify({
                  id: 'chatcmpl-123',
                  object: 'chat.completion',
                  model: 'test-model',
                  choices: [
                    {
                      index: 0,
                      message: { role: 'assistant', content: 'Hello from mock!' },
                      finish_reason: 'stop',
                    },
                  ],
                  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                }),
              ),
            )
            fakeRes.emit('end')
          })
          return fakeReq
        },
      )

      const res = await makeRequest(port, '/v1/messages', 'POST', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 100,
      })

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')

      const body = JSON.parse(res.body)
      expect(body.type).toBe('message')
      expect(body.role).toBe('assistant')
      expect(body.model).toBe('test-model')
      expect(body.content[0].text).toBe('Hello from mock!')
      expect(body.stop_reason).toBe('end_turn')
    })

    it('includes usage info in converted response', async () => {
      const fakeRes = new FakeIncomingMessage(200)
      const fakeReq = new FakeClientRequest()

      mockRequestImpl.mockImplementation(
        (_options: unknown, callback: (res: FakeIncomingMessage) => void): FakeClientRequest => {
          setImmediate(() => {
            callback(fakeRes)
            fakeRes.emit(
              'data',
              Buffer.from(
                JSON.stringify({
                  choices: [{ message: { content: 'OK' }, finish_reason: 'length' }],
                  usage: { prompt_tokens: 20, completion_tokens: 8 },
                }),
              ),
            )
            fakeRes.emit('end')
          })
          return fakeReq
        },
      )

      const res = await makeRequest(port, '/v1/messages', 'POST', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 100,
      })

      expect(res.status).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.stop_reason).toBe('max_tokens')
      expect(body.usage.input_tokens).toBe(20)
      expect(body.usage.output_tokens).toBe(8)
    })
  })

  describe('provider error responses', () => {
    it('returns 502 when provider returns 500 error', async () => {
      const fakeRes = new FakeIncomingMessage(500)
      const fakeReq = new FakeClientRequest()

      mockRequestImpl.mockImplementation(
        (_options: unknown, callback: (res: FakeIncomingMessage) => void): FakeClientRequest => {
          setImmediate(() => {
            callback(fakeRes)
            fakeRes.emit('data', Buffer.from('Internal Server Error'))
            fakeRes.emit('end')
          })
          return fakeReq
        },
      )

      const res = await makeRequest(port, '/v1/messages', 'POST', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 100,
      })

      expect(res.status).toBe(502)
      const body = JSON.parse(res.body)
      expect(body.error.type).toBe('all_providers_exhausted')
      expect(body.error.provider_errors).toBeDefined()
      expect(body.error.provider_errors.length).toBeGreaterThan(0)
    })
  })

  describe('POST /v1/messages streaming success', () => {
    it('returns event-stream for streaming OpenAI responses', async () => {
      const fakeRes = new FakeIncomingMessage(200, {
        'content-type': 'text/event-stream',
      })
      const fakeReq = new FakeClientRequest()

      mockRequestImpl.mockImplementation(
        (_options: unknown, callback: (res: FakeIncomingMessage) => void): FakeClientRequest => {
          setImmediate(() => {
            callback(fakeRes)
            // Delay events so the server can attach listeners first
            setImmediate(() => {
              fakeRes.emit(
                'data',
                Buffer.from('data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n'),
              )
              fakeRes.emit(
                'data',
                Buffer.from('data: {"choices":[{"delta":{"content":" world"},"index":0}]}\n\n'),
              )
              fakeRes.emit(
                'data',
                Buffer.from(
                  'data: {"choices":[{"finish_reason":"stop"}],"usage":{"completion_tokens":2}}\n\n',
                ),
              )
              fakeRes.emit('data', Buffer.from('data: [DONE]\n\n'))
              fakeRes.emit('end')
            })
          })
          return fakeReq
        },
      )

      const res = await makeRequest(port, '/v1/messages', 'POST', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 100,
        stream: true,
      })

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/event-stream')

      // Should contain Anthropic SSE events
      expect(res.body).toContain('event: message_start')
      expect(res.body).toContain('event: content_block_start')
      expect(res.body).toContain('event: content_block_delta')
      expect(res.body).toContain('event: message_stop')
    })
  })
})
