# CC China Stack

**One script. 5 Chinese AI providers. Claude Code running in 2 minutes.**

No config files to write. No API formats to translate. No failover logic to build.
Run `setup.sh`, add your API keys, done.

---

## What You Get

| File | Purpose |
|------|---------|
| `setup.sh` | Installs Claude Code + deepseek-router, drops in best-practice config |
| `router.config.json` | Pre-configured for 5 Chinese AI providers with circuit breaker |
| `README.md` | This guide |

---

## Requirements

- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- **At least 1 Chinese AI API key** (we recommend [DeepSeek](https://platform.deepseek.com))
- **macOS**, **Linux**, or **Windows** (Git Bash / WSL)

---

## Quick Start

### Step 1: Run the setup script

```bash
cd cc-china-stack
bash setup.sh
```

This installs Claude Code CLI, deepseek-router, and drops the config file into `~/.deepseek-router/`.

### Step 2: Add your API keys

```bash
export DEEPSEEK_API_KEY="sk-your-deepseek-key"
```

Got more providers? Add them:

```bash
export TENCENT_API_KEY="your-key"
export ZHIPU_API_KEY="your-key"
export ALIYUN_API_KEY="your-key"
export VOLCENGINE_API_KEY="your-key"
```

To make these permanent, add them to your shell config:

```bash
# macOS / Linux: ~/.bashrc or ~/.zshrc
echo 'export DEEPSEEK_API_KEY="sk-your-key"' >> ~/.bashrc

# Windows (Git Bash): ~/.bash_profile
echo 'export DEEPSEEK_API_KEY="sk-your-key"' >> ~/.bash_profile
```

### Step 3: Point Claude Code at the router

```bash
export ANTHROPIC_BASE_URL="http://localhost:8788"
export ANTHROPIC_API_KEY="router"   # any value works — the router handles auth
```

### Step 4: Start coding

```bash
claude
```

That's it. Your Claude Code now routes through 5 Chinese AI providers. If one fails, the next takes over automatically.

---

## Verify It's Working

```bash
# Check router health
deepseek-router --health

# Or start the router standalone and hit the health endpoint
deepseek-router &
curl http://localhost:8788/health
```

Expected output:

```json
{
  "status": "healthy",
  "providers": [
    {"name": "deepseek", "healthy": true},
    {"name": "tencent", "healthy": true},
    ...
  ],
  "summary": {"total": 5, "healthy": 5, "degraded": 0, "down": 0}
}
```

---

## How It Works

```
You type into Claude Code
        │
        ▼
Claude Code sends Anthropic-format request
        │
        ▼
deepseek-router receives it on localhost:8788
        │
        ├── Tries DeepSeek (cheapest, native Anthropic)
        ├── Falls back to Tencent Hunyuan
        ├── Falls back to Zhipu GLM
        ├── Falls back to Alibaba Bailian
        └── Falls back to ByteDance Volcengine
        │
        ▼
Response translated back to Anthropic format
        │
        ▼
Claude Code receives the response — never knew there was a problem
```

---

## Provider API Keys

| Provider | Signup URL | Cost per 1M tokens |
|----------|-----------|:------------------:|
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | ~$0.14 |
| Tencent Hunyuan | [console.cloud.tencent.com](https://console.cloud.tencent.com) | ~$0.14 |
| Zhipu GLM | [open.bigmodel.cn](https://open.bigmodel.cn) | ~$0.14 |
| Alibaba Bailian | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com) | ~$0.11 |
| ByteDance Volcengine | [console.volcengine.com](https://console.volcengine.com) | ~$0.11 |

> **DeepSeek alone is enough to start.** It speaks Anthropic format natively, so no translation overhead. The other 4 are your backup net.

---

## Customization

Edit `~/.deepseek-router/router.config.json`:

- **Change provider order**: Move the cheapest provider to the front of `providerOrder`
- **Adjust circuit breaker**: Raise `failureThreshold` if a provider is flaky
- **Change port**: Set `router.port` to a different number
- **Add auth**: Set `router.apiKey` to require authentication on your router

Changes take effect within seconds — no restart needed.

---

## Troubleshooting

### "claude: command not found"

```bash
npm install -g @anthropic-ai/claude-code
```

If that fails with permissions:
```bash
sudo npm install -g @anthropic-ai/claude-code
```

### "deepseek-router: command not found"

```bash
npm install -g deepseek-router
```

### API key not being picked up

Make sure you exported the variable in the same terminal session:

```bash
echo $DEEPSEEK_API_KEY   # should print your key
```

### Provider returns 401

Your API key is wrong or expired. Log into the provider's console and check.

### "Only HTTPS endpoints are allowed"

Edit `~/.deepseek-router/router.config.json` — all endpoints must start with `https://`.

---

## Advanced: Supercharg Your Workflow

CC China Stack saves you money on API costs. To also boost code quality, pair it with two free frameworks:

| Framework | What It Does | Install |
|-----------|-------------|---------|
| **gstack** | Virtual 23-person engineering team — CEO review, QA testing, security audit, one-click ship | `git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack` |
| **Superpowers** | Engineering discipline — TDD enforcement, brainstorming, systematic debugging | `/plugin install superpowers@claude-plugins-official` |

Read **[SUPERPOWERS-GSTACK-GUIDE.md](./SUPERPOWERS-GSTACK-GUIDE.md)** for the complete 9-step collaborative workflow.

### Desktop GUI: Open Cowork

Prefer a desktop app over CLI? Pair CC China Stack with Open Cowork (MIT-licensed, one-click install):

```
Open Cowork (Desktop GUI) → deepseek-router → 5 Chinese AI providers
```

Read **[OPEN-COWORK-INTEGRATION.md](./OPEN-COWORK-INTEGRATION.md)** for the step-by-step setup.

## Updates

This package uses deepseek-router, which is actively maintained. To update:

```bash
npm update -g deepseek-router
```

New config features may be added. Check the [GitHub repo](https://github.com/Cgagm/deepseek-router) for changelogs.

---

## License

MIT © Chen Gang

The configuration and scripts in this package are MIT licensed.
deepseek-router is MIT licensed: [github.com/Cgagm/deepseek-router](https://github.com/Cgagm/deepseek-router)
