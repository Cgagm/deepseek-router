import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker } from '../src/routing/circuit-breaker.js'
import { CircuitState } from '../src/types/index.js'

function makeBreaker(overrides?: {
  failureThreshold?: number
  resetTimeoutMs?: number
  halfOpenMaxRequests?: number
}) {
  return new CircuitBreaker({
    failureThreshold: overrides?.failureThreshold ?? 3,
    resetTimeoutMs: overrides?.resetTimeoutMs ?? 1000,
    halfOpenMaxRequests: overrides?.halfOpenMaxRequests ?? 2,
  })
}

describe('CircuitBreaker', () => {
  describe('initial state', () => {
    it('allows requests (closed by default)', () => {
      const cb = makeBreaker()
      expect(cb.canRequest('deepseek')).toBe(true)
    })

    it('has zero failures and requests', () => {
      const cb = makeBreaker()
      const health = cb.getHealth()
      expect(health).toHaveLength(0)
    })
  })

  describe('Closed → Open transition', () => {
    it('opens circuit after consecutive failures reach threshold', () => {
      const cb = makeBreaker({ failureThreshold: 3 })

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(true)

      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(false)

      const health = cb.getHealth()
      expect(health[0]?.state).toBe(CircuitState.Open)
      expect(health[0]?.consecutiveFailures).toBe(3)
    })

    it('resets consecutive count on success', () => {
      const cb = makeBreaker({ failureThreshold: 3 })

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      cb.recordSuccess('deepseek')
      cb.recordFailure('deepseek')

      expect(cb.canRequest('deepseek')).toBe(true)
    })
  })

  describe('Open → HalfOpen transition', () => {
    it('transitions to half-open after reset timeout', async () => {
      const cb = makeBreaker({ failureThreshold: 2, resetTimeoutMs: 50 })

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(false)

      await vi.waitFor(
        () => {
          expect(cb.canRequest('deepseek')).toBe(true)
        },
        { timeout: 200, interval: 10 },
      )

      const health = cb.getHealth()
      expect(health[0]?.state).toBe(CircuitState.HalfOpen)
    })
  })

  describe('HalfOpen behavior', () => {
    it('limits requests to halfOpenMaxRequests', () => {
      vi.useFakeTimers()
      const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 10, halfOpenMaxRequests: 2 })

      // Open the circuit
      cb.recordFailure('deepseek')

      // Wait for half-open
      vi.advanceTimersByTime(20)

      expect(cb.canRequest('deepseek')).toBe(true)
      cb.recordSuccess('deepseek')
      expect(cb.canRequest('deepseek')).toBe(true)
      cb.recordSuccess('deepseek')
      // After reaching halfOpenMaxRequests, circuit should be closed
      // but canRequest should still return true (closed state)
      expect(cb.canRequest('deepseek')).toBe(true)

      const health = cb.getHealth()
      expect(health[0]?.state).toBe(CircuitState.Closed)
      vi.useRealTimers()
    })

    it('re-opens on failure in half-open state', async () => {
      const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 50 })

      cb.recordFailure('deepseek')

      await vi.waitFor(
        () => {
          expect(cb.canRequest('deepseek')).toBe(true)
        },
        { timeout: 200, interval: 10 },
      )

      // Failure in half-open should re-open
      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(false)

      const health = cb.getHealth()
      expect(health[0]?.state).toBe(CircuitState.Open)
    })
  })

  describe('recordSuccess', () => {
    it('increments totalRequests', () => {
      const cb = makeBreaker()

      cb.recordSuccess('deepseek')
      cb.recordSuccess('deepseek')

      const health = cb.getHealth()
      expect(health[0]?.totalRequests).toBe(2)
      expect(health[0]?.totalFailures).toBe(0)
    })

    it('sets lastSuccess timestamp', () => {
      const before = Date.now()
      const cb = makeBreaker()

      cb.recordSuccess('deepseek')

      const health = cb.getHealth()
      const lastSuccess = health[0]?.lastSuccess
      expect(lastSuccess).not.toBeNull()
      expect(new Date(lastSuccess!).getTime()).toBeGreaterThanOrEqual(before)
    })
  })

  describe('recordFailure', () => {
    it('increments totalRequests and totalFailures', () => {
      const cb = makeBreaker()

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')

      const health = cb.getHealth()
      expect(health[0]?.totalRequests).toBe(2)
      expect(health[0]?.totalFailures).toBe(2)
    })

    it('sets lastFailure timestamp', () => {
      const before = Date.now()
      const cb = makeBreaker()

      cb.recordFailure('deepseek')

      const health = cb.getHealth()
      expect(health[0]?.lastFailure).not.toBeNull()
      expect(new Date(health[0]!.lastFailure!).getTime()).toBeGreaterThanOrEqual(before)
    })
  })

  describe('reset', () => {
    it('clears provider state', () => {
      const cb = makeBreaker()

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      expect(cb.getHealth()).toHaveLength(1)

      cb.reset('deepseek')
      expect(cb.getHealth()).toHaveLength(0)
    })

    it('allows requests after reset from open state', () => {
      const cb = makeBreaker({ failureThreshold: 2 })

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(false)

      cb.reset('deepseek')
      expect(cb.canRequest('deepseek')).toBe(true)
    })
  })

  describe('getHealth', () => {
    it('reports health for all tracked providers', () => {
      const cb = makeBreaker()

      cb.recordSuccess('deepseek')
      cb.recordFailure('zhipu')

      const health = cb.getHealth()
      expect(health).toHaveLength(2)

      const ds = health.find((h) => h.name === 'deepseek')
      expect(ds?.totalRequests).toBe(1)
      expect(ds?.totalFailures).toBe(0)

      const zp = health.find((h) => h.name === 'zhipu')
      expect(zp?.totalRequests).toBe(1)
      expect(zp?.totalFailures).toBe(1)
    })

    it('returns ISO date strings for timestamps', () => {
      const cb = makeBreaker()
      cb.recordSuccess('deepseek')

      const health = cb.getHealth()
      expect(health[0]?.lastSuccess).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('updateConfig', () => {
    it('changes thresholds at runtime', () => {
      const cb = makeBreaker({ failureThreshold: 5 })

      // 4 failures shouldn't open with threshold 5
      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(true)

      // Lower threshold
      cb.updateConfig({ failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxRequests: 3 })
      // But existing consecutiveFailures is 4, and threshold is now 3
      // One more failure should trigger
      cb.recordFailure('deepseek')
      expect(cb.canRequest('deepseek')).toBe(false)
    })
  })

  describe('multiple providers', () => {
    it('tracks each provider independently', () => {
      const cb = makeBreaker({ failureThreshold: 2 })

      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      // deepseek should be open
      expect(cb.canRequest('deepseek')).toBe(false)
      // zhipu should still be available
      expect(cb.canRequest('zhipu')).toBe(true)

      cb.recordSuccess('zhipu')
      const health = cb.getHealth()
      const ds = health.find((h) => h.name === 'deepseek')
      const zp = health.find((h) => h.name === 'zhipu')
      expect(ds?.state).toBe(CircuitState.Open)
      expect(zp?.state).toBe(CircuitState.Closed)
    })
  })
})
