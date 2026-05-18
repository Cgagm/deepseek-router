import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { loadConfig } from '../src/config/loader.js'
import { ConfigValidationError } from '../src/types/index.js'

const tmpDir = resolve(process.cwd(), '__tests__/__tmp__')

function writeConfig(filename: string, content: Record<string, unknown>) {
  const filepath = join(tmpDir, filename)
  writeFileSync(filepath, JSON.stringify(content, null, 2))
  return filepath
}

beforeEach(() => {
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
})

function validProviders() {
  return [
    {
      name: 'deepseek',
      displayName: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/anthropic/messages',
      apiKey: 'test-key',
      format: 'anthropic',
      authType: 'x-api-key',
      models: { 'deepseek-v4-flash': 'deepseek-chat' },
    },
    {
      name: 'tencent',
      displayName: 'Tencent Hunyuan',
      endpoint: 'https://api.tencent.com/v1/chat/completions',
      apiKey: 'test-key',
      format: 'openai',
      authType: 'bearer',
      models: {},
    },
  ]
}

function validConfig(overrides?: Record<string, unknown>) {
  return {
    providers: validProviders(),
    router: {
      providerOrder: ['deepseek', 'tencent'],
      ...overrides,
    },
  }
}

describe('loadConfig', () => {
  it('loads and validates a correct config', () => {
    const path = writeConfig('valid.json', validConfig())
    const config = loadConfig(path)

    expect(config.providers).toHaveLength(2)
    expect(config.providers[0]?.name).toBe('deepseek')
    expect(config.router.providerOrder).toEqual(['deepseek', 'tencent'])
  })

  it('applies default values', () => {
    const path = writeConfig('minimal.json', validConfig())
    const config = loadConfig(path)

    expect(config.router.port).toBe(8788)
    expect(config.router.logLevel).toBe('info')
    expect(config.router.globalTimeoutMs).toBe(120000)
    expect(config.router.defaultModel).toBe('deepseek-v4-flash')

    const provider = config.providers[0]!
    expect(provider.weight).toBe(5)
    expect(provider.timeoutMs).toBe(120000)
    expect(provider.maxRetries).toBe(2)
  })

  it('interpolates env vars in apiKey', () => {
    process.env.TEST_API_KEY = 'env-resolved-key'
    const path = writeConfig('env.json', {
      providers: [
        {
          name: 'deepseek',
          displayName: 'DeepSeek',
          endpoint: 'https://api.deepseek.com/test',
          apiKey: '$TEST_API_KEY',
          format: 'anthropic',
          models: {},
        },
      ],
      router: { providerOrder: ['deepseek'] },
    })

    const config = loadConfig(path)
    expect(config.providers[0]?.apiKey).toBe('env-resolved-key')

    delete process.env.TEST_API_KEY
  })

  it('leaves unresolved env vars as empty', () => {
    const path = writeConfig('unresolved.json', {
      providers: [
        {
          name: 'deepseek',
          displayName: 'DeepSeek',
          endpoint: 'https://api.deepseek.com/test',
          apiKey: '$MISSING_VAR_XYZ',
          format: 'anthropic',
          models: {},
        },
      ],
      router: { providerOrder: ['deepseek'] },
    })

    const config = loadConfig(path)
    expect(config.providers[0]?.apiKey).toBe('')
  })

  it('merges defaults for known providers', () => {
    const path = writeConfig('merge.json', {
      providers: [
        {
          name: 'tencent',
          displayName: 'Tencent',
          endpoint: 'https://api.tencent.com/test',
          apiKey: 'test-key',
          format: 'openai',
          models: { 'new-model': 'mapped-model' },
        },
      ],
      router: { providerOrder: ['tencent'] },
    })

    const config = loadConfig(path)
    const provider = config.providers[0]!
    // Default tencent has flash→hunyuan-lite model mapping
    expect(provider.models['flash']).toBe('hunyuan-lite')
    expect(provider.models['new-model']).toBe('mapped-model')
  })

  it('throws ConfigValidationError when no config file found', () => {
    expect(() => loadConfig('/nonexistent/path/config.json')).toThrow(ConfigValidationError)
  })

  it('throws on invalid JSON', () => {
    const path = join(tmpDir, 'bad.json')
    writeFileSync(path, '{invalid json}}')
    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
  })

  it('throws when providerOrder references unknown provider', () => {
    const path = writeConfig('unknown-provider.json', {
      providers: validProviders(),
      router: { providerOrder: ['deepseek', 'unknown_provider'] },
    })

    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
    try {
      loadConfig(path)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError)
      expect((err as ConfigValidationError).message).toContain('unknown_provider')
      expect((err as ConfigValidationError).field).toBe('router.providerOrder')
    }
  })

  it('throws when providers array is empty', () => {
    const path = writeConfig('empty-providers.json', {
      providers: [],
      router: { providerOrder: ['deepseek'] },
    })

    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
  })

  it('throws when providerOrder is empty', () => {
    const path = writeConfig('empty-order.json', {
      providers: validProviders(),
      router: { providerOrder: [] },
    })

    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
  })

  it('validates endpoint is a URL', () => {
    const path = writeConfig('bad-url.json', {
      providers: [
        {
          name: 'test',
          displayName: 'Test',
          endpoint: 'not-a-url',
          apiKey: 'key',
          format: 'openai',
          models: {},
        },
      ],
      router: { providerOrder: ['test'] },
    })

    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
  })

  it('validates format enum', () => {
    const path = writeConfig('bad-format.json', {
      providers: [
        {
          name: 'test',
          displayName: 'Test',
          endpoint: 'https://example.com/api',
          apiKey: 'key',
          format: 'invalid-format',
          models: {},
        },
      ],
      router: { providerOrder: ['test'] },
    })

    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
  })

  it('allows optional $schema field', () => {
    const cfg = { $schema: 'https://example.com/schema.json', ...validConfig() }
    const path = writeConfig('schema.json', cfg)
    const config = loadConfig(path)
    expect(config).toBeDefined()
  })

  it('validates port range', () => {
    const path = writeConfig('bad-port.json', {
      providers: validProviders(),
      router: {
        providerOrder: ['deepseek'],
        port: 80, // below 1024
      },
    })

    expect(() => loadConfig(path)).toThrow(ConfigValidationError)
  })

  it('uses custom circuit breaker defaults when not specified', () => {
    const path = writeConfig('default-cb.json', validConfig())
    const config = loadConfig(path)

    expect(config.router.circuitBreaker.failureThreshold).toBe(5)
    expect(config.router.circuitBreaker.resetTimeoutMs).toBe(30000)
    expect(config.router.circuitBreaker.halfOpenMaxRequests).toBe(3)
  })

  it('allows custom circuit breaker settings', () => {
    const path = writeConfig(
      'custom-cb.json',
      validConfig({
        circuitBreaker: {
          failureThreshold: 10,
          resetTimeoutMs: 60000,
          halfOpenMaxRequests: 5,
        },
      }),
    )
    const config = loadConfig(path)

    expect(config.router.circuitBreaker.failureThreshold).toBe(10)
    expect(config.router.circuitBreaker.resetTimeoutMs).toBe(60000)
    expect(config.router.circuitBreaker.halfOpenMaxRequests).toBe(5)
  })
})
