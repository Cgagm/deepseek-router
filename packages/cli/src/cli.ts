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
} from '@deepseek-router/core'

// ── Read package version (do this early, before config-dependent logic) ──
const _pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf-8'),
) as { version: string }
const version = _pkg.version

// ── Parse CLI arguments ──
const args = process.argv.slice(2)

function hasFlag(flag: string): boolean {
  return args.includes(flag)
}

function getArgValue(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return undefined
  const val = args[idx + 1]
  if (val && val.startsWith('--')) return undefined
  return val
}

// ── Handle flags that don't need config ──
if (hasFlag('--version') || hasFlag('-v')) {
  console.log(version)
  process.exit(0)
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`deepseek-router v${version}`)
  console.log('')
  console.log('Usage: deepseek-router [options]')
  console.log('')
  console.log('Options:')
  console.log('  --config <path>    Path to config file')
  console.log('  --port <port>      Override port (1024-65535)')
  console.log('  --log-level <lvl>  Override log level (debug|info|warn|error)')
  console.log('  --version, -v      Print version')
  console.log('  --help, -h         Show this help')
  console.log('')
  process.exit(0)
}

const configPath = getArgValue('--config')
const portOverride = getArgValue('--port')
const logLevelOverride = getArgValue('--log-level')

// ── Set log level early ──
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
