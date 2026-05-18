import type { CircuitBreaker } from '../routing/circuit-breaker.js'

export interface HealthSnapshot {
  name: string
  state: 'closed' | 'half_open' | 'open'
  failures: number
  total: number
}

export class MetricsCollector {
  private startTime: number
  private totalRequests = 0
  private activeRequests = 0
  private requestsByProvider = new Map<string, number>()
  private circuitBreaker: CircuitBreaker

  constructor(circuitBreaker: CircuitBreaker) {
    this.startTime = Date.now()
    this.circuitBreaker = circuitBreaker
  }

  requestStarted(): void {
    this.totalRequests++
    this.activeRequests++
  }

  requestCompleted(providerName: string): void {
    this.activeRequests--
    const current = this.requestsByProvider.get(providerName) ?? 0
    this.requestsByProvider.set(providerName, current + 1)
  }

  getSnapshot() {
    const health = this.circuitBreaker.getHealth()

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      requestsByProvider: Object.fromEntries(this.requestsByProvider),
      providers: health.map((h) => ({
        name: h.name,
        state: h.state,
        consecutiveFailures: h.consecutiveFailures,
        totalRequests: h.totalRequests,
        totalFailures: h.totalFailures,
        failureRate:
          h.totalRequests > 0
            ? ((h.totalFailures / h.totalRequests) * 100).toFixed(1) + '%'
            : '0%',
        lastSuccess: h.lastSuccess,
        lastFailure: h.lastFailure,
      })),
    }
  }

  /** Prometheus text format for scraping */
  getPrometheusFormat(): string {
    const snap = this.getSnapshot()
    const lines: string[] = [
      '# HELP router_uptime_seconds Total uptime in seconds',
      '# TYPE router_uptime_seconds gauge',
      `router_uptime_seconds ${snap.uptime}`,
      '',
      '# HELP router_requests_total Total requests processed',
      '# TYPE router_requests_total counter',
      `router_requests_total ${snap.totalRequests}`,
      '',
      '# HELP router_requests_active Currently active requests',
      '# TYPE router_requests_active gauge',
      `router_requests_active ${snap.activeRequests}`,
    ]

    for (const [provider, count] of Object.entries(snap.requestsByProvider)) {
      lines.push(
        '',
        `# HELP router_requests_by_provider_total Requests by provider ${provider}`,
        '# TYPE router_requests_by_provider_total counter',
        `router_requests_by_provider_total{provider="${provider}"} ${count}`,
      )
    }

    for (const p of snap.providers) {
      lines.push(
        '',
        `# HELP router_provider_failures_total Failures for provider ${p.name}`,
        '# TYPE router_provider_failures_total counter',
        `router_provider_failures_total{provider="${p.name}"} ${p.totalFailures}`,
        '',
        `# HELP router_provider_circuit_state Circuit state for provider ${p.name} (0=closed, 1=half_open, 2=open)`,
        '# TYPE router_provider_circuit_state gauge',
        `router_provider_circuit_state{provider="${p.name}"} ${p.state === 'closed' ? 0 : p.state === 'half_open' ? 1 : 2}`,
      )
    }

    return lines.join('\n') + '\n'
  }
}
