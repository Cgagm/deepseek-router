import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AnthropicRequest, ProviderConfig } from '../types/index.js'
import type { FailoverRouter, RoutedRequest } from '../routing/failover.js'
import { anthropicToOpenAI, prepareAnthropicRequest } from '../providers/adapter.js'
import { openAIToAnthropic } from '../providers/adapter.js'
import { SSEProcessor } from './stream.js'
import { createLogger } from '../observability/logger.js'
import type { CircuitBreaker } from '../routing/circuit-breaker.js'
import type { MetricsCollector } from '../observability/metrics.js'
import { getHealthReport } from '../observability/health.js'

const logger = createLogger('server')

export interface ProxyServerOptions {
  port: number
  router: FailoverRouter
  circuitBreaker: CircuitBreaker
  metrics: MetricsCollector
  version: string
}

export function createServer(options: ProxyServerOptions): http.Server {
  const { port, router, circuitBreaker, metrics, version } = options

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS — restrictive by default, allow local development
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-api-key, anthropic-version',
    )

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // ── Observability endpoints ──
    if (req.method === 'GET' && req.url === '/health') {
      const providers = router.getActiveProviders()
      const report = getHealthReport(
        circuitBreaker,
        providers,
        options.metrics.getSnapshot().uptime * 1000 +
          Date.now() -
          options.metrics.getSnapshot().uptime * 1000,
        version,
      )
      res.writeHead(report.status === 'down' ? 503 : 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(report))
      return
    }

    if (req.method === 'GET' && req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(options.metrics.getPrometheusFormat())
      return
    }

    if (req.method === 'GET' && req.url === '/') {
      const providers = router.getActiveProviders()
      const providerList = providers
        .map((p) => `  ${p.name.padEnd(12)} ${p.displayName} (${p.format})`)
        .join('\n')
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(
        `DeepSeek Router v${version}\n\nActive providers:\n${providerList}\n\nEndpoints:\n  GET  /health    Provider health status\n  GET  /metrics   Prometheus metrics\n  POST /v1/messages    Anthropic-compatible API\n`,
      )
      return
    }

    // ── API endpoint ──
    if (
      req.method === 'POST' &&
      (req.url === '/v1/messages' || req.url === '/anthropic/messages')
    ) {
      metrics.requestStarted()

      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        let request: AnthropicRequest
        try {
          request = JSON.parse(body) as AnthropicRequest
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              type: 'error',
              error: { type: 'invalid_request_error', message: 'Invalid JSON in request body' },
            }),
          )
          metrics.requestCompleted('unknown')
          return
        }

        const model = request.model ?? 'deepseek-v4-flash'
        logger.debug(
          { model, stream: request.stream, toolCount: request.tools?.length ?? 0 },
          'Incoming request',
        )

        try {
          const { result, provider } = await router.execute(
            (body: AnthropicRequest, provider: ProviderConfig) => {
              if (provider.format === 'anthropic') {
                return prepareAnthropicRequest(body, provider)
              }
              return anthropicToOpenAI(body, provider)
            },
            async (routed: RoutedRequest) => {
              const isStream = request.stream ?? false
              return makeHttpRequest(routed, isStream)
            },
            request,
          )

          metrics.requestCompleted(provider)

          if (result.stream) {
            // Streaming response
            const httpResult = result as HttpResult & {
              stream: true
              rawStream: http.IncomingMessage
            }
            if (result.format === 'anthropic') {
              // Native Anthropic SSE — pass through
              res.writeHead(httpResult.status ?? 200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
              })
              httpResult.rawStream.pipe(res)
            } else {
              // OpenAI SSE → convert to Anthropic SSE
              res.writeHead(httpResult.status ?? 200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
              })
              const processor = new SSEProcessor(model)
              httpResult.rawStream.on('data', (chunk: Buffer) => {
                const events = processor.feed(chunk)
                for (const ev of events) {
                  res.write(ev + '\n')
                }
              })
              httpResult.rawStream.on('end', () => {
                const finalEvents = processor.end()
                for (const ev of finalEvents) {
                  res.write(ev + '\n')
                }
                res.end()
              })
              httpResult.rawStream.on('error', (err: Error) => {
                logger.error({ err, provider }, 'Stream error from provider')
                try {
                  res.end()
                } catch {
                  /* connection already closed */
                }
              })
            }
          } else {
            // Non-streaming response
            const httpResult = result as HttpResult & {
              stream: false
              body: Record<string, unknown>
            }
            if (result.format === 'anthropic') {
              res.writeHead(httpResult.status ?? 200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(httpResult.body))
            } else {
              const anthropicResp = openAIToAnthropic(httpResult.body, model)
              res.writeHead(httpResult.status ?? 200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(anthropicResp))
            }
          }
        } catch (err) {
          logger.error({ err }, 'All providers failed')
          metrics.requestCompleted('all-failed')
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              type: 'error',
              error: {
                type: 'api_error',
                message: err instanceof Error ? err.message : 'All providers exhausted',
              },
            }),
          )
        }
      })

      return
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found', message: 'Not found' } }))
  })

  server.listen(port, () => {
    const startupBanner = `
╔══════════════════════════════════════════════════╗
║          DeepSeek Router v${version.padEnd(17)}║
║          ${'Listening: http://localhost:' + port}${' '.repeat(29 - String(port).length)}║
║          ${
      'Providers: ' +
      router
        .getActiveProviders()
        .map((p) => p.name)
        .join(' → ')
    }${' '.repeat(
      Math.max(
        0,
        34 -
          router
            .getActiveProviders()
            .map((p) => p.name)
            .join(' → ').length,
      ),
    )}║
╚══════════════════════════════════════════════════╝
`
    process.stdout.write('\n' + startupBanner + '\n')
    logger.info(
      { port, providers: router.getActiveProviders().map((p) => p.name) },
      'Server started',
    )
  })

  return server
}

// ── HTTP request execution ──
interface HttpResult {
  format: 'anthropic' | 'openai'
  status?: number
  stream: boolean
  body?: Record<string, unknown>
  rawStream?: http.IncomingMessage
}

function makeHttpRequest(routed: RoutedRequest, stream: boolean): Promise<HttpResult> {
  const { path, headers, body: bodyBuf } = routed
  const endpoint = routed.provider.endpoint
  const url = new URL(endpoint)

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path,
        method: 'POST',
        headers,
      },
      (res: IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errData = ''
          res.on('data', (c: Buffer) => (errData += c.toString()))
          res.on('end', () => {
            const isRateLimit = res.statusCode === 429
            const isAuth = res.statusCode === 401 || res.statusCode === 403
            const isServerErr = (res.statusCode ?? 0) >= 500
            const msg = `${routed.provider.name} ${res.statusCode}: ${errData.substring(0, 200)}`

            if (isRateLimit) {
              const { ProviderRateLimitError } = require('../types/index.js')
              reject(new ProviderRateLimitError(routed.provider.name, msg))
            } else if (isAuth) {
              const { ProviderAuthError } = require('../types/index.js')
              reject(new ProviderAuthError(routed.provider.name, res.statusCode!, msg))
            } else if (isServerErr) {
              const { ProviderServerError } = require('../types/index.js')
              reject(new ProviderServerError(routed.provider.name, res.statusCode!, msg))
            } else {
              reject(new Error(msg))
            }
          })
          return
        }

        if (stream) {
          resolve({
            format: routed.provider.format,
            stream: true,
            status: res.statusCode ?? 200,
            rawStream: res,
          } as HttpResult & { stream: true; rawStream: http.IncomingMessage })
        } else {
          let data = ''
          res.on('data', (c: Buffer) => (data += c.toString()))
          res.on('end', () => {
            try {
              const body = JSON.parse(data)
              resolve({
                format: routed.provider.format,
                stream: false,
                status: res.statusCode ?? 200,
                body,
              })
            } catch {
              reject(new Error(`${routed.provider.name}: Failed to parse response`))
            }
          })
        }
      },
    )

    req.on('error', (err: Error) => {
      reject(new Error(`${routed.provider.name}: ${err.message}`))
    })

    req.write(bodyBuf)
    req.end()
  })
}
