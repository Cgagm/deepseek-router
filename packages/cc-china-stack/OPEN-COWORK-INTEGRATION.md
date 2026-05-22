# Open Cowork Integration with CC China Stack

## What is Open Cowork?

Open Cowork is an MIT-licensed desktop GUI for AI assistants. If you prefer a desktop app over CLI, pair it with CC China Stack's deepseek-router.

## Setup (5 minutes)

### Step 1: Start deepseek-router

```bash
deepseek-router &
```

The router listens on `http://localhost:8788`.

### Step 2: Configure Open Cowork

1. Download Open Cowork from [GitHub](https://github.com/nicepkg/open-cowork)
2. Open Settings → API Configuration
3. Set:
   - **Base URL**: `http://localhost:8788`
   - **API Key**: `router` (any value works — CC China Stack handles auth)
   - **Model**: `deepseek-v4-flash`

### Step 3: Start working

All requests from Open Cowork now route through CC China Stack's 5-provider failover network.

## Architecture

```
Open Cowork (Desktop GUI) → deepseek-router:8788 → DeepSeek/Kimi/Qwen/GLM/Doubao
```

If DeepSeek fails, the next provider takes over automatically. You never notice.

## Troubleshooting

- **"Connection refused"** — deepseek-router isn't running. Run `deepseek-router &` first.
- **"401 Unauthorized"** — Your API key isn't set. Run `export DEEPSEEK_API_KEY="sk-xxx"`.
- **"Model not found"** — The model name in Open Cowork doesn't match. Check your router.config.json.
