# ACP Client - 快速开始

这是一个基于 Electron 的 ACP（Agent Client Protocol）客户端，用于与 Claude Code Agent 进行通信。

## 📋 目录

- [架构说明](#架构说明)
- [环境准备](#环境准备)
- [安装与运行](#安装与运行)
- [配置说明](#配置说明)
- [使用指南](#使用指南)
- [技术文档](#技术文档)

---

## 🏗️ 架构说明

### ACP 通信原理

```
你的 ACP Client
    ↓ 使用 @anthropic-ai/claude-agent-sdk
Claude Code Agent (本地/远程进程)
    ↓ ACP 协议
Anthropic API / Amazon Bedrock / Google Vertex AI
```

**关键点**：
- ✅ **不是直接调用 Anthropic API**，而是通过 Claude Code SDK 与 Agent 通信
- ✅ **Claude Code SDK 自动处理**：配置读取、权限管理、工具调用等
- ✅ **支持多 Provider**：Anthropic、Amazon Bedrock、Google Vertex AI

### 项目特点

- 🔄 **多会话并行** - 每个会话独立的 Claude Code Agent 实例
- 💾 **持久化存储** - SQLite 本地数据库保存所有会话
- 📡 **流式响应** - 实时显示 Claude 的思考过程
- 🎨 **现代化 UI** - 简洁、响应式、用户友好
- 🛡️ **安全通信** - 使用 Electron contextBridge，遵循最佳实践

---

## 🛠️ 环境准备

### 必需软件

- **Node.js**: >= 14.x
- **npm**: >= 7.x
- **系统要求**: macOS / Windows / Linux

### 依赖包说明

项目采用 **两层依赖管理**：

```
./package.json              # 开发依赖（webpack, babel, react 等）
./release/app/package.json  # 生产依赖（原生模块：sqlite3 等）
```

---

## 📦 安装与运行

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/acp-client.git
cd acp-client
```

### 2. 安装依赖

```bash
# 安装根目录依赖（开发工具）
npm install

# 安装生产依赖（会在 postinstall 时自动执行）
cd release/app
npm install
cd ../..
```

### 3. 启动开发环境

```bash
npm start
```

这会：
1. 启动 Webpack 开发服务器（渲染进程热重载）
2. 启动 Electron 主进程
3. 自动打开应用窗口

### 4. 打包生产版本

```bash
npm run package
```

打包后的文件位于 `release/build/` 目录。

---

## ⚙️ 配置说明

### Claude Code 配置文件

创建 `~/.claude/settings.json`：

```json
{
  "model": "sonnet",
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-api03-..."
  },
  "apiKeyHelper": "~/scripts/get-claude-key.sh",
  "permissions": {
    "allow": ["read", "write", "execute"],
    "deny": [],
    "additionalDirectories": ["/Users/username/projects"],
    "defaultMode": "ask"
  }
}
```

**配置项说明**：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `model` | 模型名称 | `"sonnet"`, `"opus"`, `"haiku"` |
| `env.ANTHROPIC_API_KEY` | API Key | `"sk-ant-..."` |
| `env.ANTHROPIC_AUTH_TOKEN` | Auth Token（可选） | `"..."` |
| `apiKeyHelper` | 获取 Key 的脚本 | `"~/scripts/get-key.sh"` |
| `permissions` | 工具权限配置 | 见下文 |

### API Key 获取方式

**优先级**（从高到低）：

1. **环境变量** - `ANTHROPIC_API_KEY`
2. **环境变量** - `ANTHROPIC_AUTH_TOKEN`
3. **apiKeyHelper** - 执行脚本获取
4. **settings.json** - `env.ANTHROPIC_API_KEY`
5. **settings.json** - `env.ANTHROPIC_AUTH_TOKEN`

**示例脚本** `~/scripts/get-claude-key.sh`：

```bash
#!/bin/bash
# 从系统密钥链获取 API Key
security find-generic-password -a "$USER" -s "claude-api-key" -w
```

### 环境变量配置

```bash
# 默认使用 Anthropic API
export ANTHROPIC_API_KEY="sk-ant-..."

# 使用 Amazon Bedrock
export AWS_REGION="us-west-2"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# 使用 Google Vertex AI
export GOOGLE_VERTEX_PROJECT_ID="..."
export GOOGLE_VERTEX_LOCATION="us-central1"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

---

## 📖 使用指南

### 创建新会话

1. 点击左侧边栏的 **"新对话"** 按钮
2. 输入消息并按 `Cmd/Ctrl + Enter` 发送
3. 实时查看 Claude 的流式响应

### 会话管理

- **删除会话**：点击会话项的删除图标
- **切换会话**：点击左侧会话列表中的任意会话
- **查看历史**：所有会话自动保存到本地 SQLite 数据库

### 工具调用（计划中）

未来版本将支持：
- 查看 Claude Code 执行的工具（读文件、写文件、执行命令）
- 工具输入/输出折叠展示
- 状态跟踪（pending/success/error）

---

## 📚 技术文档

详细的技术方案请查看：
- **[AGENTS.md](./AGENTS.md)** - 完整技术方案和架构设计
- **[项目结构](#项目结构)** - 代码组织方式

### 项目结构

```
acp-client/
├── src/
│   ├── main/                      # 主进程
│   │   ├── main.ts                # 入口
│   │   ├── preload.ts             # Preload Script（IPC 暴露）
│   │   ├── managers/
│   │   │   ├── DatabaseManager.ts # SQLite 数据库管理
│   │   │   ├── ConfigManager.ts   # 配置读取
│   │   │   └── SessionManager.ts  # Claude 会话管理
│   │   ├── claude/
│   │   │   └── ClaudeCodeProcess.ts # Claude Code Agent 封装
│   │   └── ipc/
│   │       └── handlers.ts        # IPC 处理器
│   ├── renderer/                  # 渲染进程
│   │   ├── App.tsx                # 主应用组件
│   │   ├── store/
│   │   │   └── useStore.ts        # Zustand Store
│   │   ├── hooks/
│   │   │   ├── useConversations.ts
│   │   │   └── useMessages.ts
│   │   └── components/
│   │       ├── Sidebar/           # 左侧边栏
│   │       └── Chat/              # 聊天窗口
│   └── types/
│       ├── channels.ts            # IPC 通道定义
│       └── conversation.ts        # 数据类型
├── release/app/
│   └── package.json               # 生产依赖
├── package.json                   # 开发依赖
└── AGENTS.md                      # 技术方案文档
```

### 核心技术栈

- **Electron** - 桌面应用框架
- **React 18** - UI 框架
- **TypeScript** - 类型系统
- **Zustand** - 轻量级状态管理
- **SQLite3** - 本地数据库
- **@anthropic-ai/claude-agent-sdk** - Claude Code SDK
- **Vercel AI SDK** - 流式文本处理

---

## 🔧 开发指南

### 调试

1. **主进程调试**：使用 VS Code 的 Electron 调试配置
2. **渲染进程调试**：打开 DevTools（`Cmd/Ctrl + Shift + I`）
3. **日志查看**：主进程日志输出到终端

### 常见问题

**Q: 提示 "Message injector not available"**  
A: 请先发送至少一条消息，SDK 才会初始化 injector。

**Q: 无法读取 settings.json**  
A: 确保文件路径为 `~/.claude/settings.json`，且格式正确。

**Q: SQLite 数据库文件在哪里？**  
A: 
- 开发模式：`src/sql/conversations.db`
- 生产模式：`~/Library/Application Support/ElectronReact/conversations.db`（macOS）

---

## 🚀 扩展功能（计划中）

- [ ] 工具调用可视化
- [ ] 全文搜索
- [ ] Token 使用统计
- [ ] 主题切换
- [ ] 导出功能（Markdown）
- [ ] 多 Provider 支持
- [ ] MCP Server 集成

---

## 📄 License

MIT

---

## 👥 Contributing

欢迎提交 Issue 和 Pull Request！

---

**文档版本**: v1.0  
**最后更新**: 2026/01/30
