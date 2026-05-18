# DeepSeek Router

<p align="center">
  <strong>Your Claude Code, Unbreakable.</strong><br>
  <em>5 providers. 1 endpoint. 0 lost messages.</em>
</p>

<p align="center">
  <a href="#-quick-start"><strong>⚡ Quick Start</strong></a> &nbsp;·&nbsp;
  <a href="#-why-deepseek-router">💡 Why</a> &nbsp;·&nbsp;
  <a href="#-providers">🌐 Providers</a> &nbsp;·&nbsp;
  <a href="#-api">📡 API</a> &nbsp;·&nbsp;
  <a href="#-benchmarks">📊 Benchmarks</a>
</p>

---

## ⚡ Quick Start

```bash
# 1. Clone and install
git clone https://github.com/Cgagm/deepseek-router.git
cd deepseek-router
pnpm install && pnpm run build

# 2. Set your API keys (at least 2 providers recommended)
export DEEPSEEK_API_KEY="sk-your-key"
export TENCENT_API_KEY="sk-your-key"

# 3. Launch — that's it
cp router.config.example.json router.config.json
pnpm run dev
```

```bash
# 4. Point Claude Code at it
export ANTHROPIC_BASE_URL="http://localhost:8788/v1/messages"
claude
```

**Done.** Claude Code now routes through 5 providers. If one fails, the next takes over. You won't even notice.

---

## 💡 Why DeepSeek Router?

### The Problem

Claude Code is the best AI coding tool on the planet. But it talks to **one** API endpoint. When that endpoint goes down — and it will — your conversation dies mid-sentence. Context lost. Work gone. Rage ensues.

### The Solution

DeepSeek Router sits between Claude Code and **5 independent AI providers**. When one fails, another takes over automatically. Your request never drops. Your conversation never dies.

<table>
<tr>
<td width="50%">

**Without DeepSeek Router**
```
Claude Code  →  Provider A
                      ↓
                  500 ERROR
                      ↓
              💀 Dead. Context lost.
```

</td>
<td width="50%">

**With DeepSeek Router**
```
Claude Code  →  Router  →  Provider A (fail)
                      ↓
                   Provider B (fail)
                      ↓
                   Provider C ✓
                      ↓
              🎯 Response returned.
```

</td>
</tr>
</table>

### What You Get

| Feature | Without Router | With Router |
|---------|:-------------:|:-----------:|
| Uptime | ~99.5% (single provider) | **~99.99%** (5 providers) |
| Failover | ❌ Manual | ✅ Automatic, <1ms |
| Provider choice | 1 | **5** (DeepSeek, Tencent, Zhipu, Alibaba, ByteDance) |
| Cost control | Fixed pricing | **Shop across providers** |
| Circuit breaking | ❌ | ✅ Prevents cascading failures |
| Health monitoring | ❌ | ✅ Real-time dashboard |
| Hot reload | ❌ | ✅ No restart on config change |
| API format | Provider-specific | **Anthropic Messages API** (works with Claude Code) |

---

## 🌐 Providers

All major Chinese AI providers. Mix and match. Pay only for what you use.

| Provider | Model | ~Price (1M tokens) | Format |
|----------|-------|:------------------:|--------|
| DeepSeek | deepseek-chat | $0.14 | Native Anthropic |
| Tencent Hunyuan | hunyuan-lite | $0.14 | OpenAI |
| Zhipu GLM | glm-4-flash | $0.14 | OpenAI |
| Alibaba Bailian | qwen-turbo | $0.11 | OpenAI |
| ByteDance Volcengine | doubao-lite | $0.11 | OpenAI |

> **~$0.11–$0.14 per MILLION tokens.** Claude Code's typical daily usage costs pennies.

[Setup guides for each provider →](docs/providers/)

---

## 📊 Benchmarks

```
Scenario: Provider A rate-limits during a 10-message coding session

Without Router:
  Message 1-5: ✓
  Message 6:   429 → 💀 Session dead. Start over.

With DeepSeek Router:
  Message 1-5:  Provider A ✓
  Message 6:    Provider A 429 → Provider B ✓
  Message 7-10: Provider B ✓
  Result:       Session complete. Nothing lost.

Overhead: <1ms routing decision. Zero impact on response latency.
```

---

## 🏗 Architecture

```
POST /v1/messages
       │
       ▼
┌─────────────────┐
│   Rate Limiter  │  ← per-IP token bucket (60 req/min)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Zod Validation │  ← strict request schema, 400 on invalid
└────────┬────────┘
         ▼
┌─────────────────┐
│ Failover Router │  ← priority chain, skips open circuits
└────────┬────────┘
         ▼
┌─────────────────┐
│ Circuit Breaker │  ← Closed → Open → HalfOpen → Closed
└────────┬────────┘
         ▼
┌─────────────────┐
│ Format Adapter  │  ← Anthropic ↔ OpenAI translation
└────────┬────────┘
         ▼
┌─────────────────┐
│    Provider     │  ← HTTP request with AbortSignal timeout
└─────────────────┘
```

---

## 📡 API

### `POST /v1/messages`

Anthropic Messages API — drop-in replacement for `api.anthropic.com`.

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

Supports: `system`, `stream` (SSE), `tools`, `tool_choice`, `stop_sequences`, `temperature`, `top_p`, `top_k`.

### `GET /health` — JSON health report

```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "providers": [...],
  "summary": { "total": 5, "healthy": 5, "degraded": 0, "down": 0 }
}
```

### `GET /metrics` — Prometheus format

Compatible with Grafana, Datadog, VictoriaMetrics.

### `GET /` — Human-readable status page

---

## 🔧 Configuration

Edit `router.config.json`. Changes take effect within seconds — **no restart needed**.

```jsonc
{
  "providers": [
    {
      "name": "deepseek",
      "endpoint": "https://api.deepseek.com/anthropic/messages",
      "apiKey": "$DEEPSEEK_API_KEY",    // env var interpolation
      "format": "anthropic",
      "authType": "x-api-key"
    }
  ],
  "router": {
    "providerOrder": ["deepseek", "tencent", "zhipu", "aliyun", "volcengine"],
    "port": 8788,
    "apiKey": "",                       // set to protect your router
    "circuitBreaker": {
      "failureThreshold": 5,
      "resetTimeoutMs": 30000
    }
  }
}
```

Full example with comments: [router.config.example.json](router.config.example.json)

---

## 🔒 Security

- **Auth**: Optional API key protection on all endpoints (`Authorization: Bearer` or `x-api-key`)
- **Error sanitization**: Provider API keys never leak to clients — errors return `HTTP 502`, not raw upstream bodies
- **HTTPS-only**: Config enforces HTTPS endpoints. HTTP not accepted.
- **Header injection prevention**: Custom headers validated against CRLF and reserved names
- **Zod validation**: Every request body is strictly validated before reaching providers
- **Rate limiting**: Per-IP token bucket (default: 60 req/min, 10 concurrent)

---

## 🧪 Quality

```
TypeScript strict mode  ·  158+ tests  ·  93%+ coverage  ·  Vitest  ·  CI on Node 18/20/22
```

---

## 📦 Install Options

### Option 1: Git (recommended for now)
```bash
git clone https://github.com/Cgagm/deepseek-router.git
cd deepseek-router && pnpm install && pnpm run build
```

### Option 2: One-liner (coming soon)
```bash
npx create-deepseek-router
```

### Option 3: Docker (coming soon)
```bash
docker run -p 8788:8788 -v ./router.config.json:/app/router.config.json cgagm/deepseek-router
```

---

## ❓ FAQ

**Q: Does this replace Claude API?**
No. It's a proxy. You still need API keys from the AI providers. The router makes them speak Anthropic's format and handles failover.

**Q: How many providers do I need?**
At least 2 for failover. All 5 for maximum reliability.

**Q: What's the latency overhead?**
<1ms. The router only makes routing decisions. Response data is passthrough.

**Q: Can I use this commercially?**
Yes. MIT license. Build it into your product, sell it as a service — whatever you want.

**Q: Why not use the official Claude API directly?**
You can! But if Anthropic has an outage (it happens), your work stops. This adds 4 backup paths for pennies a day.

**Q: How is this different from claude-code-router?**
claude-code-router is great (34K+ stars), but it has no circuit breaking or automatic failover. If a provider fails, your request fails. DeepSeek Router was built for one thing: **your request always succeeds**.

---

## ⭐ Star History

If this project saves you from losing a single coding session, consider giving it a star.

---

## License

MIT © Chen Gang
