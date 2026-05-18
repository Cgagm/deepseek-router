# DeepSeek Router

<p align="center">
  <strong>Production-grade multi-provider proxy for Claude Code</strong><br>
  5 Chinese AI providers · Circuit breaking · Automatic failover · Zero-downtime config
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#providers">Providers</a> ·
  <a href="#configuration">Config</a> ·
  <a href="#api">API</a> ·
  <a href="#development">Dev</a>
</p>

---

## Why

Claude Code is the best AI coding tool, but API access can be unreliable when a single provider goes down. DeepSeek Router sits between Claude Code and 5 Chinese AI providers, automatically routing around failures so you never lose a message mid-conversation.

**The problem it solves:**

- Provider A returns 500 → automatically retry with Provider B
- Provider B rate limits → switch to Provider C
- All providers healthy → use your preferred one (priority order)
- A provider recovers → circuit breaker detects it and re-enables it
- Configuration changes → hot reload, no restart needed

All of this is transparent to Claude Code. You just set `ANTHROPIC_BASE_URL` and keep coding.

## Quick Start

### 1. Get API keys

Sign up for at least 2 of the supported providers (details in [docs/providers/](docs/providers/)):

| Provider | Model | Price (1M tokens) | Sign Up |
|----------|-------|-------------------|---------|
| DeepSeek | deepseek-chat | ~$0.14 | [platform.deepseek.com](https://platform.deepseek.com) |
| Tencent Hunyuan | hunyuan-lite | ~$0.14 | [console.cloud.tencent.com](https://console.cloud.tencent.com) |
| Zhipu GLM | glm-4-flash | ~$0.14 | [open.bigmodel.cn](https://open.bigmodel.cn) |
| Alibaba Bailian | qwen-turbo | ~$0.11 | [dashscope.aliyun.com](https://dashscope.aliyun.com) |
| ByteDance Volcengine | doubao-lite | ~$0.11 | [console.volcengine.com](https://console.volcengine.com) |

### 2. Install and configure

```bash
# Install
git clone https://github.com/chengang/deepseek-router.git
cd deepseek-router
pnpm install
pnpm run build

# Create config
cp router.config.example.json router.config.json
# Edit router.config.json — set apiKey for each provider (or use env vars: $DEEPSEEK_API_KEY)
```

### 3. Launch

```bash
# Set API keys as environment variables
export DEEPSEEK_API_KEY="sk-your-key"
export TENCENT_API_KEY="sk-your-key"

# Start the router
pnpm run dev
```

### 4. Point Claude Code at it

```bash
export ANTHROPIC_BASE_URL="http://localhost:8788/v1/messages"
claude
```

Done. Claude Code now routes through DeepSeek Router.

## Architecture

```
Claude Code                    DeepSeek Router                   AI Providers
    │                              │                                │
    │  POST /v1/messages           │                                │
    ├─────────────────────────────>│                                │
    │                              │  try deepseek ───────────────>│ ✓
    │                              │  (fail)                        │
    │                              │  try tencent  ───────────────>│ ✓
    │                              │  (circuit open, skip)          │
    │                              │  try zhipu    ───────────────>│ ✓
    │                              │                                │
    │  200 OK (SSE stream)         │                                │
    │<─────────────────────────────│                                │
    │                              │                                │
```

**Internal pipeline:**

```
Request → FailoverRouter → CircuitBreaker.check() → FormatAdapter → HTTP → Provider
                                                              ↓ fail
         CircuitBreaker.recordFailure() ←─────────────────────┘
         ↓
         Try next provider
```

## Features

### Circuit Breaker
Per-provider circuit breaker prevents cascading failures. Three-state machine:

```
Closed ──(consecutive failures ≥ threshold)──> Open
Open   ──(timeout elapsed)──────────────────> HalfOpen
HalfOpen ──(success)────────────────────────> Closed
HalfOpen ──(any failure)────────────────────> Open
```

Configurable thresholds: failure count, reset timeout, half-open max requests.

### Automatic Failover
Priority-ordered provider chain. On failure, automatically tries the next provider. Skips:
- Providers with open circuit breakers
- Providers without configured API keys
- Rate-limited providers (immediate skip)

### Format Translation
Translates between Anthropic Messages API (what Claude Code speaks) and OpenAI Chat Completions API (what most Chinese providers speak).

- **Request**: system prompt → messages[0], tool_use → tool_calls, tool_result → tool role
- **Response (sync)**: tool_calls → tool_use blocks, finish_reason mapping
- **Response (streaming)**: SSE chunk-by-chunk conversion with block index tracking

### Observability
- `GET /health` — JSON health report for every provider
- `GET /metrics` — Prometheus text format (uptime, request count, circuit state gauges)
- Structured logging via Pino (JSON in production, pretty-print in dev)

### Hot Reload
Edit `router.config.json` — changes take effect within seconds without restarting:
- Add/remove providers
- Reorder priority
- Adjust circuit breaker thresholds
- Change port or log level

Invalid configs are rejected; the last valid config stays active.

## Configuration

See [router.config.example.json](router.config.example.json) for a full annotated example.

```jsonc
{
  "providers": [
    {
      "name": "deepseek",              // unique identifier
      "displayName": "DeepSeek",       // for logs and UI
      "endpoint": "https://api.deepseek.com/anthropic/messages",
      "apiKey": "$DEEPSEEK_API_KEY",   // env var interpolation
      "format": "anthropic",           // or "openai"
      "authType": "x-api-key",         // bearer | x-api-key | api-key
      "models": {                      // model name mapping
        "deepseek-v4-flash": "deepseek-chat"
      },
      "weight": 5,                     // 1-10 for weighted selection
      "timeoutMs": 120000,             // per-request timeout
      "maxRetries": 2                  // max retries for this provider
    }
  ],
  "router": {
    "providerOrder": ["deepseek", "tencent", "zhipu", "aliyun", "volcengine"],
    "circuitBreaker": {
      "failureThreshold": 5,           // consecutive failures to open
      "resetTimeoutMs": 30000,        // ms before trying half-open
      "halfOpenMaxRequests": 3        // requests allowed in half-open
    },
    "globalTimeoutMs": 120000,
    "defaultModel": "deepseek-v4-flash",
    "port": 8788,
    "logLevel": "info"
  }
}
```

## API

### `POST /v1/messages`

Anthropic Messages API compatible. Accepts the exact same request format as `https://api.anthropic.com/v1/messages`.

```bash
curl http://localhost:8788/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: any-value" \
  -d '{
    "model": "deepseek-v4-flash",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Supports streaming via `"stream": true` (SSE).

### `GET /health`

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-05-18T10:00:00.000Z",
  "version": "1.0.0",
  "providers": [
    {
      "name": "deepseek",
      "displayName": "DeepSeek",
      "circuitState": "closed",
      "consecutiveFailures": 0,
      "totalRequests": 42,
      "totalFailures": 1,
      "failureRate": "2.4%",
      "lastSuccess": "2026-05-18T09:59:00.000Z",
      "lastFailure": null
    }
  ],
  "summary": { "total": 3, "healthy": 2, "degraded": 1, "down": 0 }
}
```

### `GET /metrics`

Prometheus text format. Compatible with Grafana, Datadog, and any Prometheus-compatible scraper.

### `GET /`

Plain-text status page showing version, active providers, and available endpoints.

## Development

```bash
# Install dependencies
pnpm install

# TypeScript typecheck
pnpm run typecheck

# Run tests
pnpm run test

# Run tests with coverage
cd packages/core && npx vitest run --coverage

# Format code
pnpm run format

# Lint
pnpm run lint
```

### Project structure

```
deepseek-router/
├── packages/
│   └── core/                    # @deepseek-router/core
│       ├── src/
│       │   ├── types/           # TypeScript types + typed error hierarchy
│       │   ├── config/          # Zod-validated config loader + hot reload
│       │   ├── routing/         # Circuit breaker + failover router
│       │   ├── providers/       # Anthropic ↔ OpenAI format adapter
│       │   ├── server/          # HTTP server + SSE stream processor
│       │   ├── observability/   # Pino logger + health + Prometheus metrics
│       │   └── index.ts         # Public API barrel
│       └── __tests__/           # Unit tests (119 tests, 79% coverage)
├── router.config.example.json   # Annotated config template
├── turbo.json                   # Turborepo pipeline
├── pnpm-workspace.yaml          # Monorepo config
├── tsconfig.json                # Strict TypeScript config
└── .github/workflows/ci.yml     # GitHub Actions CI
```

## FAQ

**Does this replace the Claude API?**
No. It's a proxy. You still need API keys from the AI providers. The router just makes those providers speak Anthropic's API format and handles failover.

**Do I need all 5 providers?**
No. At least 2 is recommended for failover to work. More providers = more reliability.

**Is there latency overhead?**
< 1ms for the routing decision. The proxy doesn't touch response data — it's pure passthrough.

**Can I use this commercially?**
Yes. MIT license. Use it in your company, product, or sell it as a service.

**Why not just use claude-code-router?**
claude-code-router is an excellent project (34K+ stars), but it doesn't have circuit breaking or automatic failover. If one provider goes down, your request fails. DeepSeek Router was built specifically for reliability.

## License

MIT © Chen Gang
