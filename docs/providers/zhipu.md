# Zhipu GLM API Key Setup

Zhipu (智谱) provides an OpenAI-compatible API with competitive pricing.

## 1. Sign Up

Go to [open.bigmodel.cn](https://open.bigmodel.cn) and register.

- Phone number required (Chinese)
- No real-name verification for basic API access

## 2. Get API Key

1. Log in to [Zhipu Open Platform](https://open.bigmodel.cn)
2. Go to **API Keys** in the console
3. Click **Create API Key**
4. Copy the key

## 3. Top Up

1. Go to **Billing** → **Balance**
2. Minimum top-up: ¥1 RMB
3. Supports Alipay and WeChat Pay

## 4. Configure the Router

```jsonc
{
  "name": "zhipu",
  "displayName": "Zhipu GLM",
  "endpoint": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  "apiKey": "$ZHIPU_API_KEY",
  "format": "openai",
  "authType": "bearer",
  "models": {
    "deepseek-v4-flash": "glm-4-flash",
    "deepseek-v4-pro": "glm-4-plus"
  }
}
```

Environment variable: `ZHIPU_API_KEY`

## Pricing

| Model | Input (1M tokens) | Output (1M tokens) |
|-------|--------------------|--------------------|
| glm-4-flash | ¥0.10 | ¥0.10 |
| glm-4-plus | ¥5 | ¥5 |

GLM-4-Flash is one of the cheapest options at ~$0.014 per 1M tokens.
