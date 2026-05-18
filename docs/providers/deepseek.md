# DeepSeek API Key Setup

DeepSeek provides an Anthropic-compatible API natively — no format translation needed.

## 1. Sign Up

Go to [platform.deepseek.com](https://platform.deepseek.com) and register an account.

- Email or phone number required
- No identity verification for API access

## 2. Get API Key

1. Log in to the [DeepSeek Platform](https://platform.deepseek.com)
2. Go to **API Keys** in the left sidebar
3. Click **Create new API key**
4. Copy the key (starts with `sk-`)

## 3. Top Up (if needed)

DeepSeek requires prepaid balance.

1. Go to **Billing** → **Top Up**
2. Minimum top-up: ¥1 RMB
3. Supports Alipay and WeChat Pay

## 4. Configure the Router

```jsonc
{
  "name": "deepseek",
  "displayName": "DeepSeek",
  "endpoint": "https://api.deepseek.com/anthropic/messages",
  "apiKey": "$DEEPSEEK_API_KEY",
  "format": "anthropic",
  "authType": "x-api-key",
  "models": {
    "deepseek-v4-flash": "deepseek-chat",
    "deepseek-v4-pro": "deepseek-reasoner"
  }
}
```

Environment variable: `DEEPSEEK_API_KEY`

## Pricing

| Model | Input (1M tokens) | Output (1M tokens) |
|-------|--------------------|--------------------|
| deepseek-chat (flash) | ¥1 | ¥2 |
| deepseek-reasoner (pro) | ¥4 | ¥16 |

~$0.14 USD per 1M input tokens for the flash model.
