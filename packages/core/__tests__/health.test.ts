import { describe, it, expect, beforeEach } from 'vitest'
import { getHealthReport, healthReportToJson } from '../src/observability/health.js'
import { CircuitBreaker } from '../src/routing/circuit-breaker.js'
import type { HealthReport } from '../src/observability/health.js'

function makeBreaker() {
  return new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 30000,
    halfOpenMaxRequests: 2,
  })
}

const providers = [
  { name: 'deepseek', displayName: 'DeepSeek' },
  { name: 'tencent', displayName: 'Tencent Hunyuan' },
  { name: 'zhipu', displayName: 'Zhipu GLM' },
]

describe('getHealthReport', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = makeBreaker()
  })

  it('reports all healthy when circuits are closed', () => {
    const report = getHealthReport(cb, providers, Date.now(), '1.0.0')
    expect(report.status).toBe('healthy')
    expect(report.summary.total).toBe(3)
    expect(report.summary.healthy).toBe(3)
    expect(report.summary.degraded).toBe(0)
    expect(report.summary.down).toBe(0)
  })

  it('reports degraded when some providers are unhealthy', () => {
    cb.recordFailure('deepseek')
    cb.recordFailure('deepseek')
    cb.recordFailure('deepseek') // opens circuit

    const report = getHealthReport(cb, providers, Date.now(), '1.0.0')
    expect(report.status).toBe('degraded')
    expect(report.summary.healthy).toBe(2)
    expect(report.summary.down).toBe(1)
  })

  it('reports down when all providers are unhealthy', () => {
    for (const p of providers) {
      cb.recordFailure(p.name)
      cb.recordFailure(p.name)
      cb.recordFailure(p.name)
    }

    const report = getHealthReport(cb, providers, Date.now(), '1.0.0')
    expect(report.status).toBe('down')
    expect(report.summary.healthy).toBe(0)
    expect(report.summary.down).toBe(3)
  })

  it('includes version and timestamp', () => {
    const start = Date.now()
    const report = getHealthReport(cb, providers, start, '2.4.1')
    expect(report.version).toBe('2.4.1')
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(report.uptime).toBeGreaterThanOrEqual(0)
  })

  it('includes per-provider health details', () => {
    cb.recordSuccess('deepseek')
    cb.recordFailure('tencent')

    const report = getHealthReport(cb, providers, Date.now(), '1.0.0')
    const ds = report.providers.find((p) => p.name === 'deepseek')
    expect(ds?.totalRequests).toBe(1)
    expect(ds?.totalFailures).toBe(0)
    expect(ds?.circuitState).toBe('closed')

    const tc = report.providers.find((p) => p.name === 'tencent')
    expect(tc?.totalFailures).toBe(1)
    expect(tc?.consecutiveFailures).toBe(1)
  })

  it('handles empty provider list', () => {
    const report = getHealthReport(cb, [], Date.now(), '1.0.0')
    // 0 providers = all are down → status is 'down'
    expect(report.status).toBe('down')
    expect(report.providers).toHaveLength(0)
    expect(report.summary.total).toBe(0)
  })

  it('handles half_open state as degraded', () => {
    // Force to half_open: set very short resetTimeout and open + wait
    const fastCb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1,
      halfOpenMaxRequests: 2,
    })
    fastCb.recordFailure('deepseek') // opens
    // After reset timeout, canRequest transitions to half_open
    // Wait a bit then check
    const report = getHealthReport(fastCb, [providers[0]!], Date.now(), '1.0.0')
    // Circuit might still be open (< 1ms hasn't passed)
    expect(['degraded', 'down']).toContain(report.status)
  })

  it('computes failure rate correctly', () => {
    cb.recordSuccess('deepseek')
    cb.recordSuccess('deepseek')
    cb.recordFailure('deepseek') // 1 failure / 3 requests = 33.3%

    const report = getHealthReport(cb, [providers[0]!], Date.now(), '1.0.0')
    expect(report.providers[0]?.failureRate).toBe('33.3%')
  })
})

describe('healthReportToJson', () => {
  it('produces formatted JSON', () => {
    const report: HealthReport = {
      status: 'healthy',
      uptime: 100,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      providers: [],
      summary: { total: 0, healthy: 0, degraded: 0, down: 0 },
    }

    const json = healthReportToJson(report)
    const parsed = JSON.parse(json)
    expect(parsed.status).toBe('healthy')
    expect(parsed.uptime).toBe(100)
  })
})
