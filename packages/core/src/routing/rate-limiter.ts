import { createLogger } from '../observability/logger.js'

const logger = createLogger('rate-limiter')

export interface RateLimiterConfig {
  /** Maximum requests per window per IP */
  requestsPerWindow: number
  /** Window duration in ms */
  windowMs: number
  /** Maximum total concurrent requests */
  maxConcurrent: number
  /** Cleanup interval for stale entries (ms) */
  cleanupIntervalMs: number
  /** Entry TTL after last access (ms) */
  entryTtlMs: number
}

export const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  requestsPerWindow: 60,
  windowMs: 60_000, // 60 requests per minute
  maxConcurrent: 10,
  cleanupIntervalMs: 60_000,
  entryTtlMs: 300_000, // 5 minutes
}

interface RateLimitEntry {
  count: number
  windowStart: number
  lastAccess: number
}

/**
 * In-memory token-bucket rate limiter.
 * Tracks per-IP request counts and concurrent request limits.
 */
export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>()
  private activeCount = 0
  private config: RateLimiterConfig
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config }
    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs)
    this.cleanupTimer.unref() // don't keep the process alive
  }

  /**
   * Check if a request from the given key (IP) is allowed.
   * Returns `true` if allowed, `false` if rate limited.
   */
  checkRateLimit(key: string): boolean {
    // Concurrent limit check
    if (this.activeCount >= this.config.maxConcurrent) {
      logger.warn({ key, active: this.activeCount }, 'Concurrent request limit reached')
      return false
    }

    const now = Date.now()
    let entry = this.entries.get(key)

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      entry = { count: 0, windowStart: now, lastAccess: now }
      this.entries.set(key, entry)
    }

    entry.lastAccess = now

    if (entry.count >= this.config.requestsPerWindow) {
      logger.warn(
        { key, count: entry.count, windowMs: this.config.windowMs },
        'Rate limit exceeded',
      )
      return false
    }

    entry.count++
    return true
  }

  /** Mark a request as started (increments concurrent counter) */
  requestStarted(): void {
    this.activeCount++
  }

  /** Mark a request as completed (decrements concurrent counter) */
  requestCompleted(): void {
    if (this.activeCount > 0) this.activeCount--
  }

  /** Get current stats */
  getStats(): { activeRequests: number; trackedIps: number } {
    return {
      activeRequests: this.activeCount,
      trackedIps: this.entries.size,
    }
  }

  /** Clean up stale entries */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (now - entry.lastAccess >= this.config.entryTtlMs) {
        this.entries.delete(key)
      }
    }
  }

  /** Shut down the rate limiter */
  destroy(): void {
    clearInterval(this.cleanupTimer)
    this.entries.clear()
    this.activeCount = 0
  }
}
