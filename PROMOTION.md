# DeepSeek Router 推广资料包

---

## 一、产品一句话介绍

> **Your Claude Code, Unbreakable** — 一个命令启动 5 路中国 AI 供应商的自动故障转移代理，让 Claude Code 永不断线。

---

## 二、详细操作流程（用户教程）

### 准备工作

| 需要 | 说明 |
|------|------|
| Node.js >= 18 | https://nodejs.org 下载 LTS 版本 |
| Claude Code | 已安装并配置 |
| 至少一个 AI API Key | DeepSeek / 腾讯混元 / 智谱 / 阿里百炼 / 火山引擎 |

### 步骤 1：配置 GitHub Packages 认证

打开 https://github.com/settings/tokens → **Generate new token (classic)** → 勾选 `read:packages` → 生成 token。

```bash
# 配置认证
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN
npm config set @cgagm:registry https://npm.pkg.github.com
```

### 步骤 2：一键安装

> **注意：** 以下命令依赖步骤 1 的 GitHub 认证。未配置认证会报 401 错误。

```bash
npm install -g @cgagm/deepseek-router
```

### 步骤 3：创建配置文件

在项目目录创建 `router.config.json`：

```json
{
  "providers": [
    {
      "name": "deepseek",
      "displayName": "DeepSeek",
      "endpoint": "https://api.deepseek.com/anthropic/messages",
      "apiKey": "sk-your-deepseek-api-key",
      "format": "anthropic",
      "authType": "x-api-key",
      "models": {},
      "timeoutMs": 120000,
      "maxRetries": 2
    },
    {
      "name": "tencent",
      "displayName": "Tencent Hunyuan",
      "endpoint": "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
      "apiKey": "your-tencent-api-key",
      "format": "openai",
      "authType": "bearer",
      "models": { "deepseek-v4-flash": "hunyuan-lite", "deepseek-v4-pro": "hunyuan-pro" },
      "timeoutMs": 120000,
      "maxRetries": 2
    }
  ],
  "router": {
    "providerOrder": ["deepseek", "tencent"],
    "circuitBreaker": {
      "failureThreshold": 5,
      "resetTimeoutMs": 30000,
      "halfOpenMaxRequests": 3
    },
    "globalTimeoutMs": 120000,
    "defaultModel": "deepseek-v4-flash",
    "port": 8788,
    "logLevel": "info",
    "apiKey": ""
  }
}
```

### 步骤 4：启动路由

```bash
deepseek-router
```

或者不安装直接用（同样需要步骤 1 的认证）：

```bash
npx @cgagm/deepseek-router
```

看到启动横幅即成功：

```
╔══════════════════════════════════════════════════╗
║          DeepSeek Router v1.0.1                  ║
║          Listening: http://localhost:8788        ║
║          Providers: deepseek → tencent           ║
╚══════════════════════════════════════════════════╝
```

### 步骤 5：配置 Claude Code

在 Claude Code 设置中：

```json
{
  "ANTHROPIC_BASE_URL": "http://localhost:8788",
  "ANTHROPIC_AUTH_TOKEN": "any-value",
  "ANTHROPIC_MODEL": "deepseek-v4-pro",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash"
}
```

### 步骤 6：开始使用

```bash
claude
```

现在 Claude Code 通过你的路由器运行——任一供应商故障时自动切换到下一个。

### 监控

```bash
# 健康检查
curl http://localhost:8788/health

# 指标查看
curl http://localhost:8788/metrics

# 供应商状态
curl http://localhost:8788/
```

---

## 三、短视频脚本（60秒推广）

### 脚本结构

| 时间 | 画面 | 配音 |
|------|------|------|
| 0-5s | Claude Code 报错 "API Error" 红色界面 | "Claude Code is amazing... until your API goes down." |
| 5-10s | 一只手敲命令 `deepseek-router`，启动横幅动画弹出 | "One command. Five Chinese AI providers. Zero downtime." |
| 10-20s | 架构动画：用户 → Router → [DeepSeek|腾讯|智谱|阿里|火山] | "DeepSeek Router sits between you and 5 providers. Circuit breaker. Auto failover. Format translation. All built-in." |
| 20-30s | 配置界面：JSON 文件高亮，复制粘贴动画 | "Drop in your API keys, pick your providers, done." |
| 30-40s | Claude Code 界面，流畅对话，侧边栏显示 provider 切换日志 | "Your Claude Code now has five lives. One fails, the next takes over instantly." |
| 40-50s | 对比画面：左边无路由器=红色错误，右边有路由器=绿色流畅 | "Without it? Dead in the water. With it? Unbreakable." |
| 50-55s | GitHub URL + npm install 命令大字 | "Open source. MIT license. One npm install away." |
| 55-60s | 品牌 Logo + 标语 | "DeepSeek Router — Your Claude Code, Unbreakable." |

---

## 四、AI 视频生成提示词（一键复制）

### 提示词 1：产品介绍动画 (CapCut / Vheer AI)

```
Create a tech product intro video for a developer tool called "DeepSeek Router".

Visual style: Dark mode terminal aesthetic, neon green text on black background, clean minimalist design. Animated server racks in the background.

Scene 1: A terminal window with error text "API Error: 500 Internal Server Error" flashing red (3 seconds)
Scene 2: Hands typing on keyboard, terminal shows "deepseek-router", then a glowing ASCII art banner appears showing "DeepSeek Router v1.0.1" with provider names listed (5 seconds)
Scene 3: Animated network diagram showing a central router node connected to 5 cloud provider nodes with animated green health-check pulses. Labels: DeepSeek, Tencent Hunyuan, Zhipu GLM, Alibaba Bailian, ByteDance Volcengine. The central router glows golden. (8 seconds)
Scene 4: Split screen - left side shows broken connection (red), right side shows smooth connection (green) with text "Auto Failover" transitioning between providers (5 seconds)
Scene 5: Text overlay "5 Providers. 1 Command. 0 Downtime." with the GitHub stars count and npm install command below (4 seconds)
Scene 6: Logo "DeepSeek Router" with tagline "Your Claude Code, Unbreakable" (3 seconds)

Color palette: #00FF41 (matrix green), #1E1E1E (terminal dark), #FFD700 (gold routing lines)
Music: Ambient electronic, pulsing beat, no vocal
Aspect ratio: 16:9 horizontal
No watermark, 1080p resolution
```

### 提示词 2：快速教程 (MyEdit / CapCut)

```
A step-by-step tutorial video showing how to install and configure a developer tool.

Scene 1: Screen recording style. Terminal opens, user types "npm install @cgagm/deepseek-router --registry=https://npm.pkg.github.com". Progress bar fills up. (8 seconds)

Scene 2: Code editor opens. A JSON config file appears with fields auto-filling: apiKey, providers, port. Highlights around key fields. Text overlay: "Add your API keys". (10 seconds)

Scene 3: Terminal: "deepseek-router" is typed. The server startup banner appears with ASCII art. Green "Listening on http://localhost:8788" text. (8 seconds)

Scene 4: Claude Code settings JSON shown with ANTHROPIC_BASE_URL set to localhost:8788. Arrow: Claude Code → Router → AI Providers. (8 seconds)

Scene 5: Claude Code terminal with successful responses flowing. Split screen showing health check endpoint with green status indicators. (8 seconds)

Style: Clean screen recording overlay, dark IDE theme, smooth cursor movements, subtle zoom on key actions.
Colors: Terminal green #00FF41, dark background #0D1117 (GitHub dark)
Music: Lo-fi beat, calm and focused
```

### 提示词 3：对比演示 (Vheer AI)

```
A dramatic before/after comparison video for a reliability tool.

LEFT SIDE (Before - Without Router):
- Claude Code showing "API Error" with stack trace
- Red glow, error icons
- Text: "Single Provider = Single Point of Failure"
- Shows CLI error message fading in/out

RIGHT SIDE (After - With DeepSeek Router):
- Claude Code working smoothly
- Green glow, success icons
- Automatic provider switching animation
- Text: "5 Providers = Always Available"
- Shows health dashboard with all green

Middle: Animated arrow transitioning from left to right with text "One Command Later..."
Final frame: Both sides freeze, the right side glows brighter, tagline appears:
"DeepSeek Router. Because downtime isn't an option."

Style: Dark background, neon accents, smooth transitions
Music: Dramatic build-up, then smooth resolution
Duration: 45 seconds
Aspect: 16:9 horizontal, 1080p
```

---

## 五、社媒推广文案

### Twitter/X

```
My Claude Code kept hitting API errors. So I built a router.

npx @cgagm/deepseek-router

5 Chinese AI providers. Circuit breaking. Auto failover.
One goes down, the next takes over instantly.

Open source. MIT licensed.

github.com/Cgagm/deepseek-router
```

### LinkedIn

```
Introducing DeepSeek Router — a production-grade multi-provider proxy for Claude Code.

The Problem: Claude Code users in China rely on third-party AI APIs. When one provider goes down, your workflow stops.

The Solution: A failover router with:
- 5 Chinese AI provider support (DeepSeek, Tencent Hunyuan, Zhipu GLM, Alibaba Bailian, ByteDance Volcengine)
- Circuit breaker pattern (Closed → Open → HalfOpen)
- Automatic Anthropic ↔ OpenAI format translation
- Server-Sent Events streaming proxy
- Prometheus metrics + health checks
- Hot-reload configuration

One command to start:
npx @cgagm/deepseek-router

Open source under MIT license.
⭐ github.com/Cgagm/deepseek-router
```

### 小红书

```
标题：Claude Code 最强伴侣！5路AI供应商自动切换，永远不断线

技术栈：TypeScript · Node.js · 熔断器模式 · SSE 代理

核心功能：
✨ 5家国内AI供应商自动故障转移
✨ 熔断器保护（避免级联故障）
✨ 协议自动转换（Anthropic ↔ OpenAI）
✨ 实时流式代理
✨ 一键启动 npx @cgagm/deepseek-router

开局一张图：用Claude Code经常API报错的宝子们，这个工具就是为你准备的。

GitHub：Cgagm/deepseek-router
开源 MIT，求 Star ⭐
```

---

## 六、推荐视频工具

| 工具 | 免费版特点 | 推荐用途 |
|------|-----------|----------|
| **CapCut** | 免费无水印，完整编辑器 | 制作完整教程视频 |
| **Vheer AI** | 免费无水印，无需注册 | 快速生成短视频片段 |
| **MyEdit** | 浏览器直接使用 | 快速制作 teaser |
| **剪映** | 国内免费，模板丰富 | 中文版 CapCut |

## 七、CapCut 实操步骤

### 安装 CapCut

| 平台 | 方式 |
|------|------|
| 桌面版 | https://www.capcut.com 下载 Windows/Mac 客户端（推荐，功能最全） |
| 网页版 | https://www.capcut.com/editor 浏览器直接使用 |
| 国内用户 | 下载 **剪映**（CapCut 中国版），功能一样 |

### 生成视频

1. 打开 CapCut → 首页 → 找到 **"AI Text to Video"** 或 **"AI 文字转视频"**
2. 复制上面**提示词 1** 全文粘贴到输入框
3. 点击 **Generate** → 等待 2-5 分钟生成
4. 在时间轴中微调：删减不满意的片段、调整顺序、添加背景音乐
5. 点击 **Export** → 1080p → 导出

### CapCut 没有 AI 文字转视频？备用方案

如果 CapCut 版本不支持 AI 生成，用这些替代：
- **Vheer AI** (vheer.ai) — 免费无水印，直接粘贴提示词
- **MyEdit** (myedit.online) — 浏览器即开即用
- **Runway** (runwayml.com) — 画质最好（免费额度有限）

---

## 八、操作建议

1. **用 CapCut 做成品视频**（免费无水印，功能最全）
2. **复制上面的提示词** → 粘贴到 CapCut 的 AI 视频生成
3. **微调后导出** 1080p
4. **发布到** B站 / YouTube / 小红书 / Twitter
5. **在 GitHub README 嵌入视频链接**
