import { z } from 'zod'
import { readFileSync, existsSync, watch } from 'fs'
import { resolve, dirname } from 'path'
import type { ProviderConfig } from '../types/index.js'
import { ConfigValidationError } from '../types/index.js'
import { createLogger } from '../observability/logger.js'

const logger = createLogger('config')

// ── Zod schemas (single source of truth for validation) ──
const providerSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  format: z.enum(['anthropic', 'openai']),
  authType: z.enum(['bearer', 'x-api-key', 'api-key']).default('bearer'),
  models: z.record(z.string(), z.string()),
  headers: z.record(z.string(), z.string()).optional(),
  weight: z.number().int().min(1).max(10).default(5),
  timeoutMs: z.number().int().min(1000).max(600000).default(120000),
  maxRetries: z.number().int().min(0).max(10).default(2),
})

const circuitBreakerSchema = z.object({
  failureThreshold: z.number().int().min(1).default(5),
  resetTimeoutMs: z.number().int().min(1000).default(30000),
  halfOpenMaxRequests: z.number().int().min(1).default(3),
})

const routerConfigSchema = z.object({
  providerOrder: z.array(z.string()).min(1),
  circuitBreaker: circuitBreakerSchema.default({}),
  globalTimeoutMs: z.number().int().min(5000).default(120000),
  defaultModel: z.string().default('deepseek-v4-flash'),
  port: z.number().int().min(1024).max(65535).default(8788),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

const configFileSchema = z.object({
  $schema: z.string().optional(),
  providers: z.array(providerSchema).min(1),
  router: routerConfigSchema,
})

export type ConfigFile = z.infer<typeof configFileSchema>

// ── Default providers ──
const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: 'tencent',
    displayName: 'Tencent Hunyuan',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    apiKey: '',
    format: 'openai',
    authType: 'bearer',
    models: { flash: 'hunyuan-lite', pro: 'hunyuan-pro' },
    weight: 4,
    timeoutMs: 120000,
    maxRetries: 2,
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/anthropic/messages',
    apiKey: '',
    format: 'anthropic',
    authType: 'x-api-key',
    models: {},
    weight: 5,
    timeoutMs: 120000,
    maxRetries: 2,
  },
  {
    name: 'zhipu',
    displayName: 'Zhipu GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: '',
    format: 'openai',
    authType: 'bearer',
    models: { flash: 'glm-4-flash', pro: 'glm-4-plus' },
    weight: 3,
    timeoutMs: 120000,
    maxRetries: 2,
  },
  {
    name: 'aliyun',
    displayName: 'Alibaba Bailian',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKey: '',
    format: 'openai',
    authType: 'bearer',
    models: {},
    weight: 4,
    timeoutMs: 120000,
    maxRetries: 2,
  },
  {
    name: 'volcengine',
    displayName: 'ByteDance Volcengine',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: '',
    format: 'openai',
    authType: 'bearer',
    models: {},
    weight: 2,
    timeoutMs: 120000,
    maxRetries: 2,
  },
]

// ── Env var interpolation ──
function resolveEnvVars(value: string): string {
  return value.replace(/\$([A-Z_]+)/g, (_, name: string) => process.env[name] ?? '')
}

// ── Resolve config path ──
function resolveConfigPath(explicitPath?: string): string {
  const candidates = [
    explicitPath,
    process.env.DEEPSEEK_ROUTER_CONFIG,
    resolve(process.cwd(), 'router.config.json'),
    resolve(process.cwd(), '.deepseek-router.json'),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new ConfigValidationError(
    'No config file found. Create router.config.json in current directory, or set DEEPSEEK_ROUTER_CONFIG env var.',
  )
}

// ── Load and validate ──
export function loadConfig(configPath?: string): ConfigFile {
  const path = resolveConfigPath(configPath)
  logger.info({ path }, 'Loading configuration')

  let raw: unknown
  try {
    const content = readFileSync(path, 'utf-8')
    raw = JSON.parse(content)
  } catch (err) {
    throw new ConfigValidationError(
      `Failed to read config file: ${err instanceof Error ? err.message : err}`,
    )
  }

  const result = configFileSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new ConfigValidationError(`Configuration is invalid:\n${issues}`)
  }

  const config = result.data

  // Resolve env vars in api keys
  for (const provider of config.providers) {
    provider.apiKey = resolveEnvVars(provider.apiKey)
  }

  // Merge with defaults to fill gaps
  const mergedProviders = config.providers.map((p) => {
    const defaults = DEFAULT_PROVIDERS.find((d) => d.name === p.name)
    if (!defaults) return p
    return { ...defaults, ...p, models: { ...defaults.models, ...p.models } }
  })

  const validated: ConfigFile = {
    providers: mergedProviders,
    router: config.router,
  }

  // Validate that providerOrder references real providers
  const names = new Set(validated.providers.map((p) => p.name))
  for (const name of validated.router.providerOrder) {
    if (!names.has(name)) {
      throw new ConfigValidationError(
        `providerOrder references unknown provider "${name}". Available: ${[...names].join(', ')}`,
        'router.providerOrder',
      )
    }
  }

  // Warn about unconfigured API keys
  const unconfigured = validated.providers.filter((p) => !p.apiKey)
  if (unconfigured.length > 0) {
    logger.warn(
      { unconfigured: unconfigured.map((p) => p.name) },
      'Providers without API keys will be skipped at runtime',
    )
  }

  // Warn about providers not in the order
  const unordered = validated.providers
    .filter((p) => !validated.router.providerOrder.includes(p.name))
    .filter((p) => p.apiKey)
  if (unordered.length > 0) {
    logger.warn(
      { unordered: unordered.map((p) => p.name) },
      'Providers with API keys not in providerOrder will never be used',
    )
  }

  logger.info(
    {
      providers: validated.router.providerOrder,
      port: validated.router.port,
    },
    'Configuration loaded successfully',
  )

  return validated
}

// ── Hot reload ──
export function watchConfig(
  onReload: (config: ConfigFile) => void,
  onError: (err: ConfigValidationError) => void,
): () => void {
  const path = resolveConfigPath()
  const dir = dirname(path)

  let currentConfig: ConfigFile
  try {
    currentConfig = loadConfig(path)
  } catch (err) {
    onError(err instanceof ConfigValidationError ? err : new ConfigValidationError(String(err)))
    return () => {}
  }

  const watcher = watch(dir, { persistent: false }, (_eventType, filename) => {
    if (filename && !filename.endsWith('.json')) return
    try {
      const newConfig = loadConfig(path)
      if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
        logger.info('Configuration change detected, reloading...')
        currentConfig = newConfig
        onReload(newConfig)
      }
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        logger.error({ err }, 'Invalid configuration, keeping previous')
        onError(err)
      }
    }
  })

  return () => watcher.close()
}

export { DEFAULT_PROVIDERS }
