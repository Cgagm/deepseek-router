import http from 'node:http'
import https from 'node:https'
import { z } from 'zod'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AnthropicRequest, ProviderConfig } from '../types/index.js'
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  AllProvidersExhaustedError,
} from '../types/index.js'
import type { FailoverRouter, RoutedRequest } from '../routing/failover.js'
import { anthropicToOpenAI, prepareAnthropicRequest } from '../providers/adapter.js'
import { openAIToAnthropic } from '../providers/adapter.js'
import { SSEProcessor } from './stream.js'
import { createLogger } from '../observability/logger.js'
import type { CircuitBreaker } from '../routing/circuit-breaker.js'
import type { MetricsCollector } from '../observability/metrics.js'
import type { RateLimiter } from '../routing/rate-limiter.js'
import { getHealthReport } from '../observability/health.js'

const logger = createLogger('server')
const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB

// ── Helpers ──
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > 1_000_000) reject(new Error('Body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// ── Request body validation ──
const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.string(),
  }),
])

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(contentBlockSchema)]),
})

const toolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.record(z.unknown()),
})

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema).min(1),
  max_tokens: z.number().int().min(1),
  stream: z.boolean().optional(),
  system: z.union([z.string(), z.array(contentBlockSchema)]).optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z
    .union([
      z.object({ type: z.literal('auto') }),
      z.object({ type: z.literal('any') }),
      z.object({ type: z.literal('tool'), name: z.string() }),
      z.literal('auto'),
      z.literal('any'),
    ])
    .optional(),
  stop_sequences: z.array(z.string()).optional(),
  metadata: z.object({ user_id: z.string().optional() }).optional(),
})

let processHandlersInstalled = false

function installProcessHandlers(server: http.Server): void {
  if (processHandlersInstalled) return
  processHandlersInstalled = true

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down')
    server.close(() => process.exit(1))
    // Force exit after 5s if graceful shutdown fails
    setTimeout(() => process.exit(1), 5000)
  })

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection — shutting down')
    server.close(() => process.exit(1))
    setTimeout(() => process.exit(1), 5000)
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Received signal — shutting down gracefully')
    server.close(() => {
      logger.info('Server closed')
      process.exit(0)
    })
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit')
      process.exit(0)
    }, 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

export interface ProxyServerOptions {
  port: number
  router: FailoverRouter
  circuitBreaker: CircuitBreaker
  metrics: MetricsCollector
  version: string
  apiKey?: string
  rateLimiter?: RateLimiter
}

export function createServer(options: ProxyServerOptions): http.Server {
  const {
    port,
    router,
    circuitBreaker,
    metrics,
    version,
    apiKey: routerApiKey,
    rateLimiter,
  } = options
  const serverStartTime = Date.now()

  // Auth helper — if apiKey is configured, require it on protected endpoints
  function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (!routerApiKey) return true
    const auth = req.headers['authorization'] ?? ''
    const key = req.headers['x-api-key'] ?? ''
    if (auth === `Bearer ${routerApiKey}` || key === routerApiKey) {
      return true
    }
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid or missing API key' },
      }),
    )
    return false
  }

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS — allow local development. The proxy is intended for CLI use;
    // browser CORS is only needed for local debugging. For production deployments
    // behind a reverse proxy, configure CORS at the proxy level.
    res.setHeader('Access-Control-Allow-Origin', '*')
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

    const pathname = (req.url ?? '/').split('?')[0]

    // ── Observability endpoints ──
    if (req.method === 'GET' && pathname === '/health') {
      if (!checkAuth(req, res)) return
      const providers = router.getActiveProviders()
      const report = getHealthReport(circuitBreaker, providers, serverStartTime, version)
      res.writeHead(report.status === 'down' ? 503 : 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(report))
      return
    }

    if (req.method === 'GET' && pathname === '/metrics') {
      if (!checkAuth(req, res)) return
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(options.metrics.getPrometheusFormat())
      return
    }

    if (req.method === 'GET' && pathname === '/v1/models') {
      if (!checkAuth(req, res)) return
      const providers = router.getActiveProviders()
      const models = new Set<string>()
      for (const p of providers) {
        for (const m of Object.keys(p.models)) {
          models.add(m)
        }
      }
      const data = [...models].map((id) => ({ id, object: 'model', owned_by: 'deepseek-router' }))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ object: 'list', data }))
      return
    }

    // Claude Code calls this for token counting during context management
    if (req.method === 'POST' && pathname === '/v1/messages/count_tokens') {
      if (!checkAuth(req, res)) return
      try {
        const raw = await readBody(req)
        const body = JSON.parse(raw)
        // Rough estimate: ~2 chars per token for CJK, ~4 for English
        let count = 0
        if (body.messages) {
          for (const msg of body.messages) {
            count += Math.ceil(JSON.stringify(msg.content).length / 3.5)
          }
        }
        count = count || 1
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ input_tokens: count }))
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ input_tokens: 1 }))
      }
      return
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/') {
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
      (pathname === '/v1/messages' || pathname === '/anthropic/messages')
    ) {
      // Auth check
      if (!checkAuth(req, res)) return

      // Content-Type validation
      const [mediaType = ''] = (req.headers['content-type'] ?? '').split(';')
      const contentType = mediaType.trim()
      if (contentType !== 'application/json') {
        res.writeHead(415, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message: 'Content-Type must be application/json',
            },
          }),
        )
        return
      }

      // Rate limiting
      if (rateLimiter) {
        const clientIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
          req.socket?.remoteAddress ??
          'unknown'
        if (!rateLimiter.checkRateLimit(clientIp)) {
          res.writeHead(429, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              type: 'error',
              error: { type: 'rate_limit_error', message: 'Too many requests' },
            }),
          )
          return
        }
        rateLimiter.requestStarted()
      }

      metrics.requestStarted()
      let requestAborted = false

      let body = ''
      let bodySize = 0
      req.on('data', (chunk: Buffer) => {
        if (requestAborted) return
        bodySize += chunk.length
        if (bodySize > MAX_BODY_SIZE) {
          requestAborted = true
          metrics.requestCompleted('unknown')
          if (rateLimiter) rateLimiter.requestCompleted()
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              type: 'error',
              error: { type: 'invalid_request_error', message: 'Request body too large' },
            }),
          )
          req.destroy()
          return
        }
        body += chunk.toString()
      })

      req.on('error', () => {
        if (!requestAborted) {
          metrics.requestCompleted('unknown')
          if (rateLimiter) rateLimiter.requestCompleted()
          requestAborted = true
          try {
            res.end()
          } catch {
            /* connection already closed */
          }
        }
      })

      req.on('end', async () => {
        if (requestAborted) return

        // Validate request body with Zod (C6)
        let request: AnthropicRequest
        try {
          const parsed = JSON.parse(body)
          request = requestSchema.parse(parsed) as AnthropicRequest
        } catch (err) {
          if (err instanceof z.ZodError) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                type: 'error',
                error: {
                  type: 'invalid_request_error',
                  message: 'Request validation failed',
                  details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
                },
              }),
            )
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                type: 'error',
                error: { type: 'invalid_request_error', message: 'Invalid JSON in request body' },
              }),
            )
          }
          metrics.requestCompleted('unknown')
          if (rateLimiter) rateLimiter.requestCompleted()
          return
        }

        const model = request.model
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
          if (rateLimiter) rateLimiter.requestCompleted()

          if (result.stream) {
            // Streaming response
            const httpResult = result as HttpResult & {
              stream: true
              rawStream: http.IncomingMessage
            }
            if (result.format === 'anthropic') {
              // Native Anthropic SSE — pass through with error/close handling
              res.writeHead(httpResult.status ?? 200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
              })
              res.on('close', () => {
                httpResult.rawStream.destroy()
              })
              httpResult.rawStream.on('error', (err: Error) => {
                logger.error({ err }, 'Upstream SSE stream error (native)')
                res.destroy()
              })
              httpResult.rawStream.pipe(res)
            } else {
              // OpenAI SSE → convert to Anthropic SSE
              res.writeHead(httpResult.status ?? 200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
              })
              const processor = new SSEProcessor(model)
              let streamClosed = false
              httpResult.rawStream.on('data', (chunk: Buffer) => {
                if (streamClosed) return
                try {
                  const events = processor.feed(chunk)
                  for (const ev of events) {
                    try {
                      res.write(ev + '\n')
                    } catch {
                      streamClosed = true
                      httpResult.rawStream.destroy()
                      return
                    }
                  }
                } catch (err) {
                  logger.error({ err }, 'Error processing SSE chunk')
                  streamClosed = true
                  httpResult.rawStream.destroy()
                  try {
                    res.end()
                  } catch {
                    /* already closed */
                  }
                }
              })
              httpResult.rawStream.on('end', () => {
                if (streamClosed) return
                try {
                  const finalEvents = processor.end()
                  for (const ev of finalEvents) {
                    try {
                      res.write(ev + '\n')
                    } catch {
                      streamClosed = true
                      return
                    }
                  }
                  try {
                    res.end()
                  } catch {
                    /* already closed */
                  }
                } catch (err) {
                  logger.error({ err }, 'Error finalizing SSE stream')
                }
              })
              httpResult.rawStream.on('error', (err: Error) => {
                logger.error({ err, provider }, 'Stream error from provider')
                streamClosed = true
                try {
                  const finalEvents = processor.end()
                  for (const ev of finalEvents) {
                    try {
                      res.write(ev + '\n')
                    } catch {
                      /* client disconnected */
                    }
                  }
                } catch {
                  /* processor cleanup failed */
                }
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
          if (rateLimiter) rateLimiter.requestCompleted()
          res.writeHead(502, { 'Content-Type': 'application/json' })
          const errorBody: Record<string, unknown> = {
            type: 'api_error',
            message: err instanceof Error ? err.message : 'All providers exhausted',
          }
          if (err instanceof AllProvidersExhaustedError) {
            errorBody.type = 'all_providers_exhausted'
            errorBody.provider_errors = err.errors
          }
          const errorPayload = {
            type: 'error',
            error: errorBody,
          }
          res.end(JSON.stringify(errorPayload))
        }
      })

      return
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found', message: 'Not found' } }))
  })

  installProcessHandlers(server)

  // Server hardening — prevent connection exhaustion and slow-loris attacks
  server.timeout = 120_000 // 2 min overall socket timeout
  server.keepAliveTimeout = 5_000 // 5 sec idle between requests on same socket
  server.headersTimeout = 10_000 // 10 sec for request headers to arrive
  server.maxConnections = 200 // Limit concurrent connections
  server.maxRequestsPerSocket = 500 // Limit requests per keep-alive connection

  server.listen(port, () => {
    const addr = server.address()
    const actualPort = addr && typeof addr === 'object' ? addr.port : port
    const portStr = String(actualPort)
    const startupBanner = `
╔══════════════════════════════════════════════════╗
║          DeepSeek Router v${version.padEnd(17)}║
║          ${'Listening: http://localhost:' + actualPort}${' '.repeat(29 - portStr.length)}║
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
      { port: actualPort, providers: router.getActiveProviders().map((p) => p.name) },
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

const RESPONSE_TIMEOUT_MS = 120_000 // 2 minute response-level timeout
const MAX_ERROR_BODY = 10 * 1024 // 10KB

function makeHttpRequest(routed: RoutedRequest, stream: boolean): Promise<HttpResult> {
  const { path, headers, body: bodyBuf, signal } = routed
  const endpoint = routed.provider.endpoint
  const url = new URL(endpoint)

  return new Promise((resolve, reject) => {
    let settled = false
    const safeResolve = (val: HttpResult) => {
      if (!settled) {
        settled = true
        resolve(val)
      }
    }
    const safeReject = (err: unknown) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    }

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path,
        method: 'POST',
        headers,
        signal,
        timeout: RESPONSE_TIMEOUT_MS,
      },
      (res: IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errData = ''
          res.on('data', (c: Buffer) => {
            if (errData.length < MAX_ERROR_BODY) {
              errData += c.toString()
            }
          })
          res.on('end', () => {
            const isRateLimit = res.statusCode === 429
            const isAuth = res.statusCode === 401 || res.statusCode === 403
            const isServerErr = (res.statusCode ?? 0) >= 500
            // Sanitize error — log raw body internally, return generic message to avoid
            // leaking API keys or upstream internals to the client.
            const sanitizedMsg = `${routed.provider.name} returned HTTP ${res.statusCode}`
            logger.warn(
              {
                provider: routed.provider.name,
                status: res.statusCode,
                body: errData.substring(0, 200),
              },
              'Upstream error response',
            )

            if (isRateLimit) {
              const retryAfter = res.headers['retry-after']
                ? parseInt(res.headers['retry-after'], 10) || null
                : null
              safeReject(
                new ProviderRateLimitError(
                  routed.provider.name,
                  sanitizedMsg,
                  retryAfter ?? undefined,
                ),
              )
            } else if (isAuth) {
              safeReject(
                new ProviderAuthError(routed.provider.name, res.statusCode ?? 0, sanitizedMsg),
              )
            } else if (isServerErr) {
              safeReject(
                new ProviderServerError(routed.provider.name, res.statusCode ?? 0, sanitizedMsg),
              )
            } else {
              safeReject(new Error(sanitizedMsg))
            }
          })
          res.on('error', safeReject)
          return
        }

        if (stream) {
          safeResolve({
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
              safeResolve({
                format: routed.provider.format,
                stream: false,
                status: res.statusCode ?? 200,
                body,
              })
            } catch {
              safeReject(new Error(`${routed.provider.name}: Failed to parse response`))
            }
          })
          res.on('error', safeReject)
        }
      },
    )

    req.on('error', (err: Error) => {
      safeReject(new Error(`${routed.provider.name}: ${err.message}`))
    })

    req.write(bodyBuf)
    req.end()
  })
}
