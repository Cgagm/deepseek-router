import type { CircuitBreaker } from '../routing/circuit-breaker.js'

export interface ProviderHealthEntry {
  name: string
  displayName: string
  circuitState: string
  consecutiveFailures: number
  totalRequests: number
  totalFailures: number
  failureRate: string
  lastSuccess: string | null
  lastFailure: string | null
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  timestamp: string
  version: string
  providers: ProviderHealthEntry[]
  summary: {
    total: number
    healthy: number
    degraded: number
    down: number
  }
}

export function getHealthReport(
  circuitBreaker: CircuitBreaker,
  activeProviders: { name: string; displayName: string }[],
  startTime: number,
  version: string,
): HealthReport {
  const rawHealth = circuitBreaker.getHealth()
  const providerEntries: ProviderHealthEntry[] = []

  let healthyCount = 0
  let degradedCount = 0
  let downCount = 0

  for (const provider of activeProviders) {
    const entry = rawHealth.find((h) => h.name === provider.name)
    const failureRate =
      entry && entry.totalRequests > 0
        ? ((entry.totalFailures / entry.totalRequests) * 100).toFixed(1) + '%'
        : '0%'

    const circuitState = entry?.state ?? 'closed'

    if (circuitState === 'closed') healthyCount++
    else if (circuitState === 'half_open') degradedCount++
    else downCount++

    providerEntries.push({
      name: provider.name,
      displayName: provider.displayName,
      circuitState,
      consecutiveFailures: entry?.consecutiveFailures ?? 0,
      totalRequests: entry?.totalRequests ?? 0,
      totalFailures: entry?.totalFailures ?? 0,
      failureRate,
      lastSuccess: entry?.lastSuccess ?? null,
      lastFailure: entry?.lastFailure ?? null,
    })
  }

  // Overall status
  let status: 'healthy' | 'degraded' | 'down' = 'healthy'
  if (downCount === activeProviders.length) {
    status = 'down'
  } else if (degradedCount > 0 || downCount > 0) {
    status = 'degraded'
  }

  return {
    status,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    version,
    providers: providerEntries,
    summary: {
      total: activeProviders.length,
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
    },
  }
}

export function healthReportToJson(report: HealthReport): string {
  return JSON.stringify(report, null, 2)
}
