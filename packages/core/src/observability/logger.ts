import pino from 'pino'
import { createRequire } from 'node:module'

function tryGetTransport() {
  if (!process.stdout.isTTY) return {}
  try {
    // pino-pretty is an optional dependency — only used in dev/TTY mode.
    // If it's not installed, fall back to plain JSON logging.
    createRequire(import.meta.url).resolve('pino-pretty')
    return {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }
  } catch {
    return {}
  }
}

export function createLogger(name: string, level: string = 'info'): pino.Logger {
  return pino({
    name,
    level,
    formatters: {
      level(label) {
        return { level: label }
      },
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    ...tryGetTransport(),
  })
}

// Singleton root logger
let rootLogger: pino.Logger | null = null

export function getRootLogger(): pino.Logger {
  if (!rootLogger) {
    rootLogger = createLogger('deepseek-router', process.env.LOG_LEVEL ?? 'info')
  }
  return rootLogger
}

export function setLogLevel(level: string): void {
  const logger = getRootLogger()
  logger.level = level
}
