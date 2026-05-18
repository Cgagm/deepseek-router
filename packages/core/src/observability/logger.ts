import pino from 'pino'

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
    // In production (non-TTY), emit JSON to stderr
    // In development (TTY), use pretty printing
    ...(process.stdout.isTTY
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
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
