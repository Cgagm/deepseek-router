# Alibaba Bailian API Key Setup

Alibaba Bailian (百炼) provides an OpenAI-compatible API.

## 1. Sign Up

Go to [dashscope.aliyun.com](https://dashscope.aliyun.com) and register.

- Alibaba Cloud account required (Alipay login supported)
- Real-name verification required

## 2. Get API Key

1. Log in to the [DashScope Console](https://dashscope.aliyun.com)
2. Go to **API-KEY Management** in the left sidebar
3. Click **Create API-KEY**
4. Copy the key (starts with `sk-`)

## 3. Configure the Router

```jsonc
{
  "name": "aliyun",
  "displayName": "Alibaba Bailian",
  "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  "apiKey": "$ALIYUN_API_KEY",
  "format": "openai",
  "authType": "bearer",
  "models": {
    "deepseek-v4-flash": "qwen-turbo",
    "deepseek-v4-pro": "qwen-plus"
  }
}
```

Environment variable: `ALIYUN_API_KEY`

## Pricing

| Model | Input (1M tokens) | Output (1M tokens) |
|-------|--------------------|--------------------|
| qwen-turbo (flash) | ¥0.3 | ¥0.6 |
| qwen-plus (pro) | ¥0.8 | ¥2.0 |

~$0.04 USD per 1M input tokens for the turbo model.
