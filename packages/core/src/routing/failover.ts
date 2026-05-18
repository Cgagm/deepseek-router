import type { ProviderConfig, RouterConfig, AnthropicRequest } from '../types/index.js'
import { CircuitBreaker } from './circuit-breaker.js'
import {
  ProviderTimeoutError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  AllProvidersExhaustedError,
  CircuitState,
} from '../types/index.js'
import { createLogger } from '../observability/logger.js'

const logger = createLogger('router')

export interface RoutedRequest {
  provider: ProviderConfig
  path: string
  headers: Record<string, string>
  body: Buffer
  signal?: AbortSignal
}

export type RequestPreparer = (
  body: AnthropicRequest,
  provider: ProviderConfig,
) => { path: string; headers: Record<string, string>; body: Buffer }

/**
 * Failover router — tries providers in order, skipping unhealthy ones.
 * Providers isolated by circuit breaker are automatically skipped.
 */
export class FailoverRouter {
  private providerMap: Map<string, ProviderConfig>
  private order: string[]
  private circuitBreaker: CircuitBreaker
  private config: RouterConfig

  constructor(providers: ProviderConfig[], config: RouterConfig, circuitBreaker: CircuitBreaker) {
    this.providerMap = new Map(providers.map((p) => [p.name, p]))
    this.order = config.providerOrder.filter((n) => this.providerMap.has(n))
    this.circuitBreaker = circuitBreaker
    this.config = config
  }

  /**
   * Try each provider in priority order.
   * Skips: unconfigured keys, open circuits, rate-limited providers.
   * Returns the first successful response or throws AllProvidersExhaustedError.
   */
  async execute<T>(
    preparer: RequestPreparer,
    requestFn: (routed: RoutedRequest) => Promise<T>,
    body: AnthropicRequest,
  ): Promise<{ result: T; provider: string }> {
    const { order, config } = this
    const errors: Array<{ provider: string; message: string }> = []

    for (const providerName of order) {
      const provider = this.providerMap.get(providerName)
      if (!provider) {
        logger.warn({ provider: providerName }, 'Provider in router order not found, skipping')
        continue
      }

      // Skip if no API key
      if (!provider.apiKey) {
        continue
      }

      // Skip if circuit is open
      if (!this.circuitBreaker.canRequest(providerName)) {
        errors.push({
          provider: providerName,
          message: 'Circuit breaker open',
        })
        logger.debug({ provider: providerName }, 'Skipped — circuit open')
        continue
      }

      try {
        const prepared = preparer(body, provider)
        const controller = new AbortController()
        const routed: RoutedRequest = { ...prepared, provider, signal: controller.signal }

        const timeoutMs = provider.timeoutMs ?? config.globalTimeoutMs
        let timer: ReturnType<typeof setTimeout> | undefined

        const result = await Promise.race([
          requestFn(routed),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort()
              reject(new ProviderTimeoutError(providerName, 'Request timed out'))
            }, timeoutMs)
          }),
        ])

        clearTimeout(timer)
        this.circuitBreaker.recordSuccess(providerName)
        logger.debug({ provider: providerName }, `Request succeeded via ${provider.displayName}`)
        return { result, provider: providerName }
      } catch (err) {
        this.circuitBreaker.recordFailure(providerName)

        const message = err instanceof Error ? err.message : String(err)
        errors.push({ provider: providerName, message })

        // Classify error for logging
        if (err instanceof ProviderTimeoutError) {
          logger.warn({ provider: providerName }, 'Provider timed out, trying next')
        } else if (err instanceof ProviderRateLimitError) {
          logger.info({ provider: providerName }, 'Rate limited, trying next')
        } else if (err instanceof ProviderAuthError) {
          logger.error({ provider: providerName }, 'Authentication failed — check API key')
        } else if (err instanceof ProviderServerError) {
          logger.warn({ provider: providerName }, 'Server error, trying next')
        } else {
          logger.warn({ provider: providerName, err: message }, 'Request failed, trying next')
        }
      }
    }

    // All providers exhausted
    const activeProviders = order
      .map((n) => this.providerMap.get(n))
      .filter((p): p is ProviderConfig => !!p)
      .map((p) => p.name)

    throw new AllProvidersExhaustedError(
      activeProviders.map((name) => {
        const entry = this.circuitBreaker.getHealth().find((h) => h.name === name)
        const state = entry?.state ?? CircuitState.Closed
        const error = errors.find((e) => e.provider === name)
        return {
          provider: name,
          message: `${state === CircuitState.Open ? '[OPEN] ' : ''}${error?.message ?? 'No attempt'}`,
        }
      }),
    )
  }

  /** Return active (has key) providers ordered by priority */
  getActiveProviders(): ProviderConfig[] {
    return this.order
      .map((n) => this.providerMap.get(n))
      .filter((p): p is ProviderConfig => !!p && !!p.apiKey)
  }

  /** Reload providers without restarting (hot reload) */
  reloadProviders(providers: ProviderConfig[], newOrder: string[]): void {
    this.providerMap = new Map(providers.map((p) => [p.name, p]))
    this.order = newOrder.filter((n) => this.providerMap.has(n))
    // Reset circuits so new config takes effect
    for (const name of this.providerMap.keys()) {
      this.circuitBreaker.reset(name)
    }
    logger.info({ order: this.order }, 'Providers reloaded')
  }
}
