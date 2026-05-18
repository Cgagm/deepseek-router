import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FailoverRouter } from '../src/routing/failover.js'
import type { RoutedRequest } from '../src/routing/failover.js'
import { CircuitBreaker } from '../src/routing/circuit-breaker.js'
import {
  ProviderTimeoutError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  AllProvidersExhaustedError,
} from '../src/types/index.js'
import type { ProviderConfig, RouterConfig, AnthropicRequest } from '../src/types/index.js'

function makeProviders(): ProviderConfig[] {
  return [
    {
      name: 'deepseek',
      displayName: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/anthropic/messages',
      apiKey: 'sk-ds',
      format: 'anthropic',
      authType: 'x-api-key',
      models: {},
      weight: 5,
      timeoutMs: 5000,
      maxRetries: 2,
    },
    {
      name: 'tencent',
      displayName: 'Tencent Hunyuan',
      endpoint: 'https://api.tencent.com/v1/chat/completions',
      apiKey: 'sk-tc',
      format: 'openai',
      authType: 'bearer',
      models: {},
      weight: 4,
      timeoutMs: 5000,
      maxRetries: 2,
    },
    {
      name: 'zhipu',
      displayName: 'Zhipu GLM',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: 'sk-zp',
      format: 'openai',
      authType: 'bearer',
      models: {},
      weight: 3,
      timeoutMs: 5000,
      maxRetries: 2,
    },
  ]
}

function makeConfig(overrides?: Partial<RouterConfig>): RouterConfig {
  return {
    providerOrder: ['deepseek', 'tencent', 'zhipu'],
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxRequests: 2 },
    globalTimeoutMs: 10000,
    defaultModel: 'deepseek-v4-flash',
    port: 8788,
    logLevel: 'info',
    ...overrides,
  }
}

function makeRequest(): AnthropicRequest {
  return {
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 4096,
  }
}

// Simple preparer for testing
function testPreparer(body: AnthropicRequest, provider: ProviderConfig) {
  return {
    path: '/v1/messages',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
    body: Buffer.from(JSON.stringify(body)),
  }
}

describe('FailoverRouter', () => {
  let cb: CircuitBreaker
  let providers: ProviderConfig[]
  let config: RouterConfig

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxRequests: 2 })
    providers = makeProviders()
    config = makeConfig()
  })

  describe('basic routing', () => {
    it('returns first provider result on success', async () => {
      const router = new FailoverRouter(providers, config, cb)

      const requestFn = vi.fn().mockResolvedValue({ ok: true, provider: 'deepseek' })

      const { result, provider } = await router.execute(testPreparer, requestFn, makeRequest())

      expect(result).toEqual({ ok: true, provider: 'deepseek' })
      expect(provider).toBe('deepseek')
      expect(requestFn).toHaveBeenCalledTimes(1)
    })

    it('records success with circuit breaker', async () => {
      const router = new FailoverRouter(providers, config, cb)
      const requestFn = vi.fn().mockResolvedValue({ ok: true })

      await router.execute(testPreparer, requestFn, makeRequest())

      const health = cb.getHealth()
      const ds = health.find((h) => h.name === 'deepseek')
      expect(ds?.totalRequests).toBe(1)
      expect(ds?.totalFailures).toBe(0)
    })
  })

  describe('failover', () => {
    it('falls back to second provider when first fails', async () => {
      const router = new FailoverRouter(providers, config, cb)

      const requestFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({ ok: true, provider: 'tencent' })

      const { result, provider } = await router.execute(testPreparer, requestFn, makeRequest())

      expect(result).toEqual({ ok: true, provider: 'tencent' })
      expect(provider).toBe('tencent')
      expect(requestFn).toHaveBeenCalledTimes(2)
    })

    it('records failure on the failed provider', async () => {
      const router = new FailoverRouter(providers, config, cb)

      const requestFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ ok: true })

      await router.execute(testPreparer, requestFn, makeRequest())

      const health = cb.getHealth()
      const ds = health.find((h) => h.name === 'deepseek')
      expect(ds?.totalFailures).toBe(1)
      expect(ds?.totalRequests).toBe(1)
    })
  })

  describe('circuit breaker integration', () => {
    it('skips providers with open circuit', async () => {
      // Open circuit for deepseek
      const strictCb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 30000,
        halfOpenMaxRequests: 2,
      })
      strictCb.recordFailure('deepseek') // Opens immediately

      const router = new FailoverRouter(providers, config, strictCb)

      const requestFn = vi.fn().mockResolvedValue({ ok: true })

      const { provider } = await router.execute(testPreparer, requestFn, makeRequest())

      // Should skip deepseek (open) and go straight to tencent
      expect(provider).toBe('tencent')
    })
  })

  describe('provider without apiKey', () => {
    it('skips providers with empty apiKey', async () => {
      const providersNoKey = [{ ...providers[0]!, apiKey: '' }, ...providers.slice(1)]
      const router = new FailoverRouter(providersNoKey, config, cb)

      const requestFn = vi.fn().mockResolvedValue({ ok: true })

      const { provider } = await router.execute(testPreparer, requestFn, makeRequest())

      // Should skip deepseek (no key) and use tencent
      expect(provider).toBe('tencent')
    })
  })

  describe('timeout', () => {
    it('rejects on timeout and tries next provider', async () => {
      // Use very short timeouts with real timers instead of fake timers
      // to avoid unhandled rejection issues with Promise.race + fake timers
      const timeoutProviders = providers.map((p) => ({ ...p, timeoutMs: 1 }))
      const router = new FailoverRouter(timeoutProviders, config, cb)

      // Each request takes 60s to resolve (well above 1ms timeout)
      const requestFn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 60000)
          }),
      )

      await expect(router.execute(testPreparer, requestFn, makeRequest())).rejects.toThrow(
        AllProvidersExhaustedError,
      )
    }, 10000)
  })

  describe('error classification', () => {
    it('throws AllProvidersExhaustedError when all providers fail', async () => {
      const router = new FailoverRouter(providers, config, cb)

      const requestFn = vi.fn().mockRejectedValue(new Error('fail'))

      await expect(router.execute(testPreparer, requestFn, makeRequest())).rejects.toThrow(
        AllProvidersExhaustedError,
      )
    })

    it('includes error details in AllProvidersExhaustedError', async () => {
      const router = new FailoverRouter(providers, config, cb)

      const requestFn = vi
        .fn()
        .mockRejectedValueOnce(new ProviderTimeoutError('deepseek', 'timeout'))
        .mockRejectedValueOnce(new ProviderRateLimitError('tencent', 'rate limited'))
        .mockRejectedValueOnce(new ProviderServerError('zhipu', 500, 'server error'))

      try {
        await router.execute(testPreparer, requestFn, makeRequest())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AllProvidersExhaustedError)
        const exhausted = err as AllProvidersExhaustedError
        expect(exhausted.errors).toHaveLength(3)

        const dsErr = exhausted.errors.find((e) => e.provider === 'deepseek')
        expect(dsErr?.message).toContain('timeout')
      }
    })
  })

  describe('getActiveProviders', () => {
    it('returns only providers with API keys', () => {
      const mixedProviders = [{ ...providers[0]!, apiKey: '' }, providers[1]!, providers[2]!]
      const router = new FailoverRouter(mixedProviders, config, cb)

      const active = router.getActiveProviders()
      expect(active).toHaveLength(2)
      expect(active.map((p) => p.name)).toEqual(['tencent', 'zhipu'])
    })

    it('returns providers in priority order', () => {
      const router = new FailoverRouter(providers, config, cb)
      const active = router.getActiveProviders()
      expect(active.map((p) => p.name)).toEqual(['deepseek', 'tencent', 'zhipu'])
    })

    it('respects custom providerOrder', () => {
      const customConfig = makeConfig({ providerOrder: ['zhipu', 'deepseek', 'tencent'] })
      const router = new FailoverRouter(providers, customConfig, cb)
      const active = router.getActiveProviders()
      expect(active.map((p) => p.name)).toEqual(['zhipu', 'deepseek', 'tencent'])
    })
  })

  describe('reloadProviders', () => {
    it('updates provider list at runtime', () => {
      const router = new FailoverRouter(providers, config, cb)
      expect(router.getActiveProviders()).toHaveLength(3)

      const newProviders = [providers[0]!, providers[1]!] // only 2
      router.reloadProviders(newProviders, ['deepseek', 'tencent'])

      expect(router.getActiveProviders()).toHaveLength(2)
    })

    it('resets circuit breakers on reload', () => {
      const router = new FailoverRouter(providers, config, cb)
      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')
      cb.recordFailure('deepseek')

      router.reloadProviders(providers, ['deepseek', 'tencent', 'zhipu'])

      // Circuit should be reset
      expect(cb.canRequest('deepseek')).toBe(true)
    })
  })

  describe('provider logging', () => {
    it('classifies ProviderAuthError', async () => {
      const router = new FailoverRouter(providers, config, cb)

      const requestFn = vi
        .fn()
        .mockRejectedValueOnce(new ProviderAuthError('deepseek', 401, 'unauthorized'))
        .mockResolvedValueOnce({ ok: true })

      const { provider } = await router.execute(testPreparer, requestFn, makeRequest())

      // Should have failed over to tencent
      expect(provider).toBe('tencent')
    })
  })

  describe('preparer receives correct arguments', () => {
    it('passes body and provider to preparer', async () => {
      const router = new FailoverRouter(providers, config, cb)
      const preparerSpy = vi.fn().mockReturnValue({
        path: '/v1/test',
        headers: {},
        body: Buffer.from('{}'),
      })
      const requestFn = vi.fn().mockResolvedValue({ ok: true })

      const body = makeRequest()
      await router.execute(preparerSpy, requestFn, body)

      expect(preparerSpy).toHaveBeenCalledWith(body, providers[0])
    })
  })
})
