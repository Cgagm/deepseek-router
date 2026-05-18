// DeepSeek Router — Production-grade multi-provider proxy for Claude Code
// Core package exports

// Types
export {
  CircuitState,
  RouterError,
  ProviderTimeoutError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  AllProvidersExhaustedError,
  ConfigValidationError,
} from './types/index.js'
export type {
  ProviderConfig,
  RouterConfig,
  AnthropicRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicTool,
  AnthropicToolChoice,
  ApiFormat,
  ProviderHealth,
  RouterMetrics,
} from './types/index.js'

// Config
export { loadConfig, watchConfig, DEFAULT_PROVIDERS } from './config/loader.js'
export type { ConfigFile } from './config/loader.js'

// Routing
export { CircuitBreaker } from './routing/circuit-breaker.js'
export { FailoverRouter } from './routing/failover.js'
export type { RoutedRequest, RequestPreparer } from './routing/failover.js'
export { RateLimiter, DEFAULT_RATE_LIMIT } from './routing/rate-limiter.js'
export type { RateLimiterConfig } from './routing/rate-limiter.js'

// Providers
export {
  anthropicToOpenAI,
  openAIToAnthropic,
  prepareAnthropicRequest,
} from './providers/adapter.js'

// Server
export { createServer } from './server/server.js'
export type { ProxyServerOptions } from './server/server.js'
export { SSEProcessor, openAIChunkToAnthropicEvents } from './server/stream.js'

// Observability
export { createLogger, setLogLevel, getRootLogger } from './observability/logger.js'
export { getHealthReport, healthReportToJson } from './observability/health.js'
export type { HealthReport, ProviderHealthEntry } from './observability/health.js'
export { MetricsCollector } from './observability/metrics.js'
export type { HealthSnapshot } from './observability/metrics.js'
