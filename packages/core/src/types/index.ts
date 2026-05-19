// ── Provider definition ──
export type ApiFormat = 'anthropic' | 'openai'

export interface ProviderConfig {
  /** Unique provider identifier */
  name: string
  /** Display name for logs and UI */
  displayName: string
  /** API base URL (including /v1/chat/completions or /anthropic/messages) */
  endpoint: string
  /** API key (supports env var interpolation: $ENV_VAR) */
  apiKey: string
  /** API format spoken by this provider */
  format: ApiFormat
  /** Auth header type: 'bearer' for OpenAI, 'x-api-key' for Anthropic, 'api-key' for some */
  authType: 'bearer' | 'x-api-key' | 'api-key'
  /** Model name mapping: { flash: 'model-flash', pro: 'model-pro' } */
  models: Record<string, string>
  /** Extra headers to send */
  headers?: Record<string, string>
  /** Request timeout in ms (default: inherits from globalTimeoutMs) */
  timeoutMs?: number
  /** Max retries for transient errors (default: 2) */
  maxRetries?: number
}

// ── Circuit breaker state ──
export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half_open',
}

export interface CircuitBreakerConfig {
  /** Consecutive failures before opening circuit */
  failureThreshold: number
  /** Ms to wait before trying half-open */
  resetTimeoutMs: number
  /** Ms to wait in half-open before fully closing */
  halfOpenMaxRequests: number
}

// ── Router configuration ──
export interface RouterConfig {
  /** Ordered list of provider names to try */
  providerOrder: string[]
  circuitBreaker: CircuitBreakerConfig
  /** Global request timeout in ms */
  globalTimeoutMs: number
  /** Default model tier when not specified */
  defaultModel: string
  /** Listen port */
  port: number
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  /** Optional API key to protect the proxy endpoint. If set, requests must include this key. */
  apiKey?: string
  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum requests per window per IP */
    requestsPerWindow?: number
    /** Window duration in ms (default: 60000) */
    windowMs?: number
    /** Maximum total concurrent requests */
    maxConcurrent?: number
  }
}

// ── Health ──
export interface ProviderHealth {
  name: string
  state: CircuitState
  consecutiveFailures: number
  lastFailure: string | null
  lastSuccess: string | null
  totalRequests: number
  totalFailures: number
}

// ── Metrics ──
export interface RouterMetrics {
  uptime: number
  providers: ProviderHealth[]
  totalRequests: number
  activeRequests: number
  requestsByProvider: Record<string, number>
}

// ── Error types (typed hierarchy, no string codes) ──
export abstract class RouterError extends Error {
  abstract readonly provider: string
}

export class ProviderTimeoutError extends RouterError {
  readonly kind = 'timeout' as const
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(`${provider}: ${message}`)
    this.name = 'ProviderTimeoutError'
  }
}

export class ProviderAuthError extends RouterError {
  readonly kind = 'auth' as const
  readonly statusCode: number
  constructor(
    readonly provider: string,
    statusCode: number,
    message: string,
  ) {
    super(`${provider}: ${message}`)
    this.name = 'ProviderAuthError'
    this.statusCode = statusCode
  }
}

export class ProviderRateLimitError extends RouterError {
  readonly kind = 'rate_limit' as const
  readonly retryAfter: number | null
  constructor(
    readonly provider: string,
    message: string,
    retryAfter?: number,
  ) {
    super(`${provider}: ${message}`)
    this.name = 'ProviderRateLimitError'
    this.retryAfter = retryAfter ?? null
  }
}

export class ProviderServerError extends RouterError {
  readonly kind = 'server_error' as const
  readonly statusCode: number
  constructor(
    readonly provider: string,
    statusCode: number,
    message: string,
  ) {
    super(`${provider}: ${message}`)
    this.name = 'ProviderServerError'
    this.statusCode = statusCode
  }
}

export class AllProvidersExhaustedError extends RouterError {
  readonly kind = 'all_exhausted' as const
  readonly errors: { provider: string; message: string }[]
  readonly provider = 'all'
  constructor(errors: { provider: string; message: string }[]) {
    super(`All providers exhausted: ${errors.map((e) => e.provider).join(', ')}`)
    this.name = 'AllProvidersExhaustedError'
    this.errors = errors
  }
}

export class ConfigValidationError extends RouterError {
  readonly kind = 'config_validation' as const
  readonly provider = 'system'
  readonly field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ConfigValidationError'
    this.field = field
  }
}

// ── Anthropic API types (Claude Code speaks this) ──
export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface AnthropicRequest {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  stream?: boolean
  system?: string | AnthropicContentBlock[]
  temperature?: number
  top_p?: number
  top_k?: number
  tools?: AnthropicTool[]
  tool_choice?: AnthropicToolChoice
  stop_sequences?: string[]
  metadata?: { user_id?: string }
}

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export type AnthropicToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }
