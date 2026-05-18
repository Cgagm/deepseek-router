#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import {
  loadConfig,
  CircuitBreaker,
  FailoverRouter,
  MetricsCollector,
  RateLimiter,
  createServer,
  setLogLevel,
} from '@cgagm/deepseek-router-core'

// ── Parse CLI arguments ──
const args = process.argv.slice(2)

function getArgValue(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return undefined
  const val = args[idx + 1]
  if (val && val.startsWith('--')) return undefined
  return val
}

const configPath = getArgValue('--config')
const portOverride = getArgValue('--port')
const logLevelOverride = getArgValue('--log-level')

// ── Set log level early (before config load so bootstrap logging is affected) ──
if (logLevelOverride) {
  setLogLevel(logLevelOverride)
}

// ── Load configuration ──
const config = loadConfig(configPath)

// ── Apply CLI overrides ──
if (portOverride) {
  const parsed = parseInt(portOverride, 10)
  if (Number.isNaN(parsed) || parsed < 1024 || parsed > 65535) {
    console.error(`Invalid port: ${portOverride}. Must be an integer between 1024 and 65535.`)
    process.exit(1)
  }
  config.router.port = parsed
}

if (logLevelOverride) {
  const validLevels = ['debug', 'info', 'warn', 'error'] as const
  if (!validLevels.includes(logLevelOverride as (typeof validLevels)[number])) {
    console.error(
      `Invalid log level: ${logLevelOverride}. Must be one of: ${validLevels.join(', ')}.`,
    )
    process.exit(1)
  }
  config.router.logLevel = logLevelOverride as 'debug' | 'info' | 'warn' | 'error'
}

// ── Read package version ──
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgPath = resolve(__dirname, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
const version = pkg.version

// ── Create core components ──
const circuitBreaker = new CircuitBreaker(config.router.circuitBreaker)
const router = new FailoverRouter(config.providers, config.router, circuitBreaker)
const metrics = new MetricsCollector(circuitBreaker)
const rateLimiter = new RateLimiter(config.router.rateLimit)

// ── Start server ──
// The server installs its own SIGTERM/SIGINT handlers via createServer().
// The server reference is kept in-scope so the event loop stays alive.
const server = createServer({
  port: config.router.port,
  router,
  circuitBreaker,
  metrics,
  version,
  apiKey: config.router.apiKey,
  rateLimiter,
})
void server
