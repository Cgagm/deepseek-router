# Tencent Hunyuan API Key Setup

Tencent Hunyuan provides an OpenAI-compatible API.

## 1. Sign Up

Go to [console.cloud.tencent.com](https://console.cloud.tencent.com) and register.

- Phone number required (Chinese or international)
- Real-name verification required for API access

## 2. Enable Hunyuan Service

1. Go to [Hunyuan Console](https://console.cloud.tencent.com/hunyuan)
2. Click **Enable Service** (开通服务)
3. Accept the service agreement

## 3. Get API Key

1. Go to [API Keys](https://console.cloud.tencent.com/cam/capi)
2. Click **Create Key**
3. Copy **SecretId** and **SecretKey**

Tencent uses SecretId + SecretKey pairs (not a single API key). Combine them as `SecretId:SecretKey`.

## 4. Configure the Router

```jsonc
{
  "name": "tencent",
  "displayName": "Tencent Hunyuan",
  "endpoint": "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
  "apiKey": "$TENCENT_API_KEY",
  "format": "openai",
  "authType": "bearer",
  "models": {
    "deepseek-v4-flash": "hunyuan-lite",
    "deepseek-v4-pro": "hunyuan-pro"
  }
}
```

Set `TENCENT_API_KEY` to `SecretId:SecretKey` (colon-separated).

Example:
```bash
export TENCENT_API_KEY="AKIDxxxxxxxx:xxxxxxxxxxxxx"
```

## Pricing

| Model | Input (1M tokens) | Output (1M tokens) |
|-------|--------------------|--------------------|
| hunyuan-lite (flash) | Free | Free |
| hunyuan-pro | ¥3 | ¥10 |

Hunyuan-lite is free for now — ideal as a backup provider.
