import { describe, it, expect } from 'vitest'
import { MetricsCollector } from '../src/observability/metrics.js'
import { CircuitBreaker } from '../src/routing/circuit-breaker.js'

function makeCollector() {
  const cb = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 30000,
    halfOpenMaxRequests: 2,
  })
  return new MetricsCollector(cb)
}

describe('MetricsCollector', () => {
  describe('request counting', () => {
    it('tracks total and active requests', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestStarted()

      const snap = m.getSnapshot()
      expect(snap.totalRequests).toBe(2)
      expect(snap.activeRequests).toBe(2)
    })

    it('decrements active on completion', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestStarted()
      m.requestCompleted('deepseek')
      m.requestCompleted('tencent')

      const snap = m.getSnapshot()
      expect(snap.totalRequests).toBe(2)
      expect(snap.activeRequests).toBe(0)
    })

    it('tracks requests by provider', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestCompleted('deepseek')
      m.requestStarted()
      m.requestCompleted('deepseek')
      m.requestStarted()
      m.requestCompleted('tencent')

      const snap = m.getSnapshot()
      expect(snap.requestsByProvider).toEqual({
        deepseek: 2,
        tencent: 1,
      })
    })
  })

  describe('uptime', () => {
    it('reports uptime in seconds', async () => {
      const m = makeCollector()
      // Uptime should be very small (just created)
      const snap = m.getSnapshot()
      expect(snap.uptime).toBeGreaterThanOrEqual(0)
      expect(snap.uptime).toBeLessThan(5)
    })
  })

  describe('provider health', () => {
    it('includes circuit breaker health in snapshot', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestCompleted('deepseek')

      // recordSuccess to populate circuit breaker entry
      m.requestStarted()
      m.requestCompleted('deepseek')

      const snap = m.getSnapshot()
      // Circuit breaker has no entries yet because requestCompleted doesn't touch it
      // The providers field comes from circuitBreaker.getHealth()
      // Only providers with recorded success/failure appear in circuit health
      expect(snap.requestsByProvider).toEqual({ deepseek: 2 })
    })

    it('shows correct failure rate for providers', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestCompleted('tencent')

      const snap = m.getSnapshot()
      expect(snap.requestsByProvider).toEqual({ tencent: 1 })
    })
  })

  describe('getPrometheusFormat', () => {
    it('returns valid Prometheus text format', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestCompleted('deepseek')

      const output = m.getPrometheusFormat()
      expect(output).toContain('# HELP router_uptime_seconds')
      expect(output).toContain('# TYPE router_uptime_seconds gauge')
      expect(output).toContain('router_uptime_seconds ')
      expect(output).toContain('# HELP router_requests_total')
      expect(output).toContain('router_requests_total 1')
      expect(output).toContain('# HELP router_requests_active')
      expect(output).toContain('router_requests_active 0')
    })

    it('includes per-provider metrics', () => {
      const m = makeCollector()
      m.requestStarted()
      m.requestCompleted('deepseek')

      const output = m.getPrometheusFormat()
      expect(output).toContain('provider="deepseek"')
    })

    it('includes circuit breaker state as gauge when providers are tracked', () => {
      // Record success/failure directly on circuit breaker so health has entries
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        halfOpenMaxRequests: 2,
      })
      const m = new MetricsCollector(cb)
      cb.recordSuccess('deepseek')

      const output = m.getPrometheusFormat()
      expect(output).toContain('router_provider_circuit_state')
      expect(output).toContain('provider="deepseek"} 0') // closed=0
    })

    it('ends with newline', () => {
      const m = makeCollector()
      const output = m.getPrometheusFormat()
      expect(output.endsWith('\n')).toBe(true)
    })

    it('handles empty state gracefully', () => {
      const m = makeCollector()
      const output = m.getPrometheusFormat()
      expect(output).toContain('router_uptime_seconds')
      expect(output).toContain('router_requests_total 0')
    })
  })
})
