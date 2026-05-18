import { CircuitState } from '../types/index.js'
import type { CircuitBreakerConfig } from '../types/index.js'
import { createLogger } from '../observability/logger.js'

const loggers = new Map<string, ReturnType<typeof createLogger>>()

function getLogger(name: string) {
  if (!loggers.has(name)) loggers.set(name, createLogger(`circuit:${name}`))
  return loggers.get(name)!
}

interface CircuitEntry {
  state: CircuitState
  consecutiveFailures: number
  totalFailures: number
  totalRequests: number
  lastFailure: number | null
  lastSuccess: number | null
  openedAt: number | null
  halfOpenCount: number
  pendingRequests: number
  nextRetryAfter: number
}

/**
 * Circuit breaker — isolates failing providers.
 *
 * State machine:
 *   Closed → (failures >= threshold) → Open
 *   Open   → (timeout elapsed)       → HalfOpen
 *   HalfOpen → (success)             → Closed
 *   HalfOpen → (failure)             → Open
 */
export class CircuitBreaker {
  private entries = new Map<string, CircuitEntry>()
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  /** Check if a provider is available to handle a request */
  canRequest(providerName: string): boolean {
    const entry = this.getOrCreate(providerName)

    switch (entry.state) {
      case CircuitState.Closed:
        return true

      case CircuitState.Open:
        if (Date.now() >= entry.nextRetryAfter) {
          entry.state = CircuitState.HalfOpen
          entry.halfOpenCount = 0
          getLogger(providerName).info('Circuit transitioning to half-open')
          return true
        }
        return false

      case CircuitState.HalfOpen:
        if (entry.halfOpenCount + entry.pendingRequests >= this.config.halfOpenMaxRequests) {
          return false
        }
        entry.pendingRequests++
        return true

      default:
        return true
    }
  }

  /** Record a successful request */
  recordSuccess(providerName: string): void {
    const entry = this.getOrCreate(providerName)
    const logger = getLogger(providerName)

    entry.totalRequests++
    entry.lastSuccess = Date.now()
    if (entry.pendingRequests > 0) entry.pendingRequests--

    if (entry.state === CircuitState.HalfOpen) {
      entry.halfOpenCount++
      if (entry.halfOpenCount >= this.config.halfOpenMaxRequests) {
        entry.state = CircuitState.Closed
        entry.consecutiveFailures = 0
        entry.openedAt = null
        logger.info('Circuit closed — provider healthy')
      }
    } else {
      entry.consecutiveFailures = 0
    }
  }

  /** Record a failed request */
  recordFailure(providerName: string): void {
    const entry = this.getOrCreate(providerName)
    const logger = getLogger(providerName)

    entry.totalRequests++
    entry.totalFailures++
    entry.consecutiveFailures++
    if (entry.pendingRequests > 0) entry.pendingRequests--
    entry.lastFailure = Date.now()

    if (entry.state === CircuitState.HalfOpen || entry.state === CircuitState.Closed) {
      if (entry.consecutiveFailures >= this.config.failureThreshold) {
        entry.state = CircuitState.Open
        entry.openedAt = Date.now()
        entry.nextRetryAfter = Date.now() + this.config.resetTimeoutMs
        logger.warn(
          {
            failures: entry.consecutiveFailures,
            retryAfter: new Date(entry.nextRetryAfter).toISOString(),
          },
          'Circuit opened — provider isolated',
        )
      }
    }
  }

  /** Reset a specific provider's circuit (useful for manual intervention) */
  reset(providerName: string): void {
    this.entries.delete(providerName)
    getLogger(providerName).info('Circuit manually reset')
  }

  /** Get health stats for all providers */
  getHealth(): Array<{
    name: string
    state: CircuitState
    consecutiveFailures: number
    totalFailures: number
    totalRequests: number
    lastFailure: string | null
    lastSuccess: string | null
  }> {
    return [...this.entries.entries()].map(([name, entry]) => ({
      name,
      state: entry.state,
      consecutiveFailures: entry.consecutiveFailures,
      totalFailures: entry.totalFailures,
      totalRequests: entry.totalRequests,
      lastFailure: entry.lastFailure ? new Date(entry.lastFailure).toISOString() : null,
      lastSuccess: entry.lastSuccess ? new Date(entry.lastSuccess).toISOString() : null,
    }))
  }

  /** Update configuration at runtime */
  updateConfig(config: CircuitBreakerConfig): void {
    this.config = config
  }

  private getOrCreate(providerName: string): CircuitEntry {
    if (!this.entries.has(providerName)) {
      this.entries.set(providerName, {
        state: CircuitState.Closed,
        consecutiveFailures: 0,
        totalFailures: 0,
        totalRequests: 0,
        lastFailure: null,
        lastSuccess: null,
        openedAt: null,
        halfOpenCount: 0,
        pendingRequests: 0,
        nextRetryAfter: 0,
      })
    }
    return this.entries.get(providerName)!
  }
}
