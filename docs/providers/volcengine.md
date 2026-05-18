# ByteDance Volcengine API Key Setup

ByteDance Volcengine (火山引擎) provides an OpenAI-compatible API.

## 1. Sign Up

Go to [console.volcengine.com](https://console.volcengine.com) and register.

- Phone or email registration
- Real-name verification required for API access

## 2. Enable Model Service

1. Go to [ARK Console](https://console.volcengine.com/ark)
2. Click **Access Management** → **API Keys**
3. Create an API key

You also need to create an inference endpoint:

1. Go to **Inference Endpoints** (推理接入点)
2. Click **Create Endpoint**
3. Select model (e.g., Doubao-lite)
4. Copy the endpoint URL

## 3. Configure the Router

```jsonc
{
  "name": "volcengine",
  "displayName": "ByteDance Volcengine",
  "endpoint": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  "apiKey": "$VOLCENGINE_API_KEY",
  "format": "openai",
  "authType": "bearer",
  "models": {
    "deepseek-v4-flash": "doubao-lite-32k",
    "deepseek-v4-pro": "doubao-pro-32k"
  }
}
```

**Important:** Volcengine requires you to create an inference endpoint first. The endpoint URL is specific to your account/model. Update the `endpoint` field with your actual endpoint URL.

Environment variable: `VOLCENGINE_API_KEY`

## Pricing

| Model | Input (1M tokens) | Output (1M tokens) |
|-------|--------------------|--------------------|
| doubao-lite-32k (flash) | ¥0.3 | ¥0.6 |
| doubao-pro-32k (pro) | ¥1.5 | ¥6 |

~$0.04 USD per 1M input tokens for the lite model.
