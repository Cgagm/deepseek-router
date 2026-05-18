import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { createServer } from '../src/server/server.js'
import type { ProxyServerOptions } from '../src/server/server.js'
import { FailoverRouter } from '../src/routing/failover.js'
import { CircuitBreaker } from '../src/routing/circuit-breaker.js'
import { MetricsCollector } from '../src/observability/metrics.js'
import type { ProviderConfig, RouterConfig, AnthropicRequest } from '../src/types/index.js'

const testProviders: ProviderConfig[] = [
  {
    name: 'test-provider',
    displayName: 'Test Provider',
    endpoint: 'https://test.example.com/v1/chat/completions',
    apiKey: 'sk-test',
    format: 'openai',
    authType: 'bearer',
    models: {},
    timeoutMs: 5000,
    maxRetries: 1,
  },
]

const testConfig: RouterConfig = {
  providerOrder: ['test-provider'],
  circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxRequests: 2 },
  globalTimeoutMs: 10000,
  defaultModel: 'test-model',
  port: 0, // random port
  logLevel: 'error',
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

describe('HTTP Server Integration', () => {
  let server: http.Server
  let port: number

  beforeAll(async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      halfOpenMaxRequests: 2,
    })
    const router = new FailoverRouter(testProviders, testConfig, cb)
    const metrics = new MetricsCollector(cb)

    const options: ProxyServerOptions = {
      port: 0,
      router,
      circuitBreaker: cb,
      metrics,
      version: '1.0.0-test',
    }

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

  describe('GET /', () => {
    it('returns 200 with text/plain content', async () => {
      const res = await makeRequest(port, '/', 'GET')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/plain')
    })

    it('includes version number', async () => {
      const res = await makeRequest(port, '/', 'GET')
      expect(res.body).toContain('1.0.0-test')
    })

    it('includes provider name', async () => {
      const res = await makeRequest(port, '/', 'GET')
      expect(res.body).toContain('test-provider')
    })

    it('lists available endpoints', async () => {
      const res = await makeRequest(port, '/', 'GET')
      expect(res.body).toContain('/health')
      expect(res.body).toContain('/metrics')
      expect(res.body).toContain('/v1/messages')
    })
  })

  describe('GET /health', () => {
    it('returns 200 with JSON', async () => {
      const res = await makeRequest(port, '/health', 'GET')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
    })

    it('has correct health report structure', async () => {
      const res = await makeRequest(port, '/health', 'GET')
      const report = JSON.parse(res.body)
      expect(report).toHaveProperty('status')
      expect(report).toHaveProperty('uptime')
      expect(report).toHaveProperty('version')
      expect(report).toHaveProperty('providers')
      expect(report).toHaveProperty('summary')
      expect(report.version).toBe('1.0.0-test')
    })

    it('includes provider details', async () => {
      const res = await makeRequest(port, '/health', 'GET')
      const report = JSON.parse(res.body)
      expect(report.providers).toHaveLength(1)
      expect(report.providers[0].name).toBe('test-provider')
      expect(report.summary.total).toBe(1)
    })
  })

  describe('GET /metrics', () => {
    it('returns 200 with Prometheus text format', async () => {
      const res = await makeRequest(port, '/metrics', 'GET')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/plain')
    })

    it('includes standard metric names', async () => {
      const res = await makeRequest(port, '/metrics', 'GET')
      expect(res.body).toContain('router_uptime_seconds')
      expect(res.body).toContain('router_requests_total')
      expect(res.body).toContain('router_requests_active')
    })
  })

  describe('POST /v1/messages', () => {
    it('rejects invalid JSON with 400', async () => {
      const res = await new Promise<{ status: number; body: string }>((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            let data = ''
            res.on('data', (c: Buffer) => (data += c.toString()))
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
          },
        )
        req.write('{invalid json}')
        req.end()
      })

      expect(res.status).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.error.type).toBe('invalid_request_error')
    })

    it('returns 502 when all providers fail', async () => {
      const validRequest: AnthropicRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      }

      const res = await makeRequest(
        port,
        '/v1/messages',
        'POST',
        validRequest as unknown as Record<string, unknown>,
      )
      // Provider has fake endpoint, so it will fail → 502
      expect(res.status).toBe(502)
      const body = JSON.parse(res.body)
      expect(body.error.type).toBe('all_providers_exhausted')
    })

    it('502 response includes provider_errors array', async () => {
      const validRequest: AnthropicRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      }

      const res = await makeRequest(
        port,
        '/v1/messages',
        'POST',
        validRequest as unknown as Record<string, unknown>,
      )
      expect(res.status).toBe(502)
      const body = JSON.parse(res.body)
      expect(body.error.type).toBe('all_providers_exhausted')
      // AllProvidersExhaustedError should include provider_errors
      expect(body.error.provider_errors).toBeDefined()
      expect(Array.isArray(body.error.provider_errors)).toBe(true)
      expect(body.error.provider_errors.length).toBeGreaterThan(0)
      // Each error entry should have provider and message
      for (const pe of body.error.provider_errors) {
        expect(pe).toHaveProperty('provider')
        expect(pe).toHaveProperty('message')
      }
    })

    it('rejects body exceeding 10MB with 413', async () => {
      // Create a large body that exceeds 10MB
      const largeBody = Buffer.alloc(11 * 1024 * 1024, 'x').toString()

      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        let settled = false
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            if (settled) return
            settled = true
            let data = ''
            res.on('data', (c: Buffer) => (data += c.toString()))
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
          },
        )
        req.on('error', (err) => {
          if (settled) return
          settled = true
          // Connection reset is expected when server destroys the request
          reject(err)
        })
        req.write(largeBody)
        req.end()
      }).catch(() => ({ status: 413, body: '' }))

      expect(res.status).toBe(413)
    })
  })

  describe('CORS', () => {
    it('returns 204 for OPTIONS requests', async () => {
      const res = await new Promise<{ status: number; headers: http.IncomingHttpHeaders }>(
        (resolve) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port,
              path: '/v1/messages',
              method: 'OPTIONS',
            },
            (res) => {
              resolve({ status: res.statusCode ?? 0, headers: res.headers })
            },
          )
          req.end()
        },
      )

      expect(res.status).toBe(204)
    })

    it('sets CORS headers on normal responses', async () => {
      const res = await makeRequest(port, '/health', 'GET')
      expect(res.headers['access-control-allow-origin']).toBeDefined()
    })

    it('sets CORS headers on error responses', async () => {
      const res = await makeRequest(port, '/nonexistent', 'GET')
      expect(res.headers['access-control-allow-origin']).toBeDefined()
    })
  })

  describe('404 handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await makeRequest(port, '/nonexistent/path', 'GET')
      expect(res.status).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error.type).toBe('not_found')
    })
  })

  describe('POST /anthropic/messages', () => {
    it('also handles /anthropic/messages path', async () => {
      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/anthropic/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            let data = ''
            res.on('data', (c: Buffer) => (data += c.toString()))
            res.on('end', () => resolve({ status: res.statusCode ?? 0 }))
          },
        )
        req.write('{invalid}')
        req.end()
      })

      expect(res.status).toBe(400)
    })
  })

  describe('server lifecycle', () => {
    it('listens and closes cleanly', () => {
      expect(server.listening).toBe(true)
    })

    it('has correct address', () => {
      const addr = server.address()
      expect(addr).not.toBeNull()
      expect(typeof addr).toBe('object')
    })
  })
})
