# ACP Client - Claude Code 通信客户端技术方案

> 最后更新时间：2026/01/30

## 目录

- [项目概述](#项目概述)
- [架构设计](#架构设计)
- [技术栈](#技术栈)
- [数据模型](#数据模型)
- [Claude Code 集成](#claude-code-集成)
- [IPC 通信设计](#ipc-通信设计)
- [前端实现](#前端实现)
- [项目结构](#项目结构)
- [实施步骤](#实施步骤)
- [关键技术难点](#关键技术难点)
- [扩展功能](#扩展功能)

---

## 项目概述

### 目标

开发一个基于 Electron 的桌面应用，通过 ACP（Agent Client Protocol）与 Claude Code 进行通信，实现：

- 多会话并行（每个会话独立的 Claude Code 进程）
- 完整会话记录持久化
- 流式消息响应
- 简洁现代的聊天界面

### 核心价值

**ACP 通信的本质**：

```
你（ACP Client）
↔ Claude Code 进程（ACP Agent Server）
↔ Claude LLM（由 Claude Code 自己负责）
```

- 通信对象是 **Claude Code 本地/远程 Agent 进程**，不是模型本身
- Claude Code 在这里扮演的是一个 **ACP Agent Server**
- 通过 stdin/stdout 进行 JSON-RPC 通信（类似 LSP）

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────┐
│          Electron 主进程                     │
│  ┌────────────────────────────────────────┐ │
│  │ Session Manager                         │ │
│  │  - 管理多个 Claude Code 子进程          │ │
│  │  - 每个会话一个独立 claude-code 实例    │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │ SQLite Database Manager                │ │
│  │  - conversations                        │ │
│  │  - messages                             │ │
│  │  - tool_calls                           │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │ Config Manager                          │ │
│  │  - 读取 ~/.claude/settings.json         │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
              ↕ IPC (contextBridge)
┌─────────────────────────────────────────────┐
│          Electron 渲染进程                   │
│  ┌────────────────────────────────────────┐ │
│  │ React App                               │ │
│  │  ┌──────────────┬───────────────────┐  │ │
│  │  │ 左侧边栏     │ 右侧聊天窗口      │  │ │
│  │  │ - 会话列表   │ - 消息流         │  │ │
│  │  │ - 新建会话   │ - 输入框         │  │ │
│  │  │ - 搜索过滤   │ - 工具调用展示   │  │ │
│  │  └──────────────┴───────────────────┘  │ │
│  │                                         │ │
│  │ Zustand State:                          │ │
│  │  - conversations[]                      │ │
│  │  - currentConversationId                │ │
│  │  - messages[]                           │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 进程通信流程

1. **渲染进程** → 调用 `window.electronAPI.sendMessage()`
2. **主进程 IPC Handler** → 接收请求
3. **SessionManager** → 获取/创建 Claude 会话
4. **ClaudeCodeProcess** → 调用 Claude Agent SDK
5. **流式响应** → 通过 `MESSAGE_STREAM` 通道实时发送
6. **渲染进程 Zustand Store** → 更新状态，UI 自动刷新

---

## 技术栈

### 核心技术

- **Electron** - 桌面应用框架（主进程 + 渲染进程 + Preload 沙箱）
- **React 18** - UI 框架
- **TypeScript** - 类型系统
- **Zustand** - 轻量级状态管理（**注意：必须使用 `import { create } from 'zustand/react'` 引入**）
- **SQLite3** - 本地数据库
- **@anthropic-ai/claude-agent-sdk** - Claude Code SDK
- **Vercel AI SDK** - 流式文本处理

### 脚手架

- **electron-react-boilerplate** - 提供开箱即用的 Webpack 配置、热重载、打包工具

### 依赖管理

采用 **两个 package.json** 结构：

```
./package.json           # 开发依赖（webpack, babel, react 等）
./release/app/package.json  # 生产依赖（原生模块：sqlite3 等）
```

这种结构可以显著减少打包后的应用体积。

---

## 数据模型

### SQLite Schema

#### 1. 会话表（conversations）

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,          -- UUID
  title TEXT NOT NULL,          -- 会话标题
  created_at INTEGER NOT NULL,  -- 创建时间戳
  updated_at INTEGER NOT NULL,  -- 更新时间戳
  status TEXT DEFAULT 'active', -- active | archived
  claude_session_id TEXT        -- Claude Code 的 session ID (用于恢复)
);

CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
```

#### 2. 消息表（messages）

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- user | assistant | system
  content TEXT,                 -- 文本内容
  created_at INTEGER NOT NULL,
  metadata TEXT,                -- JSON: { tokens, model, etc }
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

#### 3. 工具调用记录表（tool_calls）

```sql
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,      -- 工具名称
  input TEXT,                   -- JSON 输入
  output TEXT,                  -- JSON 输出
  status TEXT DEFAULT 'pending', -- pending | success | error
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_tool_calls_message ON tool_calls(message_id);
```

### TypeScript 类型定义

```typescript
// src/types/conversation.ts
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  claudeSessionId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  metadata?: {
    tokens?: number;
    model?: string;
    reasoning?: string;
  };
}

export interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  input: any;
  output?: any;
  status: 'pending' | 'success' | 'error';
  createdAt: number;
}
```

---

## Claude Code 集成

### 集成方案：使用 @anthropic-ai/claude-agent-sdk

本项目使用 **@anthropic-ai/claude-agent-sdk** 和 **Vercel AI SDK** 集成 Claude Code Agent，通过 ACP（Agent Client Protocol）进行通信。

#### 架构说明

```
ACP Client (本应用)
    ↓
claudeCode() from @anthropic-ai/claude-agent-sdk
    ↓ ACP 协议通信
Claude Code Agent (本地/远程进程)
    ↓
Anthropic API / 其他 Provider
```

**关键点**：
- **不是直接调用 Anthropic API**，而是通过 Claude Code SDK 与 Agent 通信
- **Claude Code SDK 自动处理**：配置读取、权限管理、工具调用等
- **settingSources: ['user']** 会自动读取 `~/.claude/settings.json`
- 支持多种 **Provider**：Anthropic、Amazon Bedrock、Google Vertex AI 等

#### ClaudeCodeProcess 类

```typescript
// src/main/claude/ClaudeCodeProcess.ts
import { streamText } from 'ai';
import { claudeCode, type MessageInjector } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeConfig {
  model?: string;
  systemPrompt?: string;
  apiKey?: string;
  provider?: string; // 支持配置 provider
}

export class ClaudeCodeProcess {
  private sessionId: string;
  private config: ClaudeConfig;
  private model: any = null;
  private injector: MessageInjector | null = null;

  constructor(sessionId: string, config: ClaudeConfig) {
    this.sessionId = sessionId;
    this.config = config;
  }

  /**
   * 延迟初始化：只在第一次发送消息时创建 Claude Code Agent
   */
  private async getModel() {
    if (this.model) return this.model;

    // 创建 claudeCode agent
    // settingSources: ['user'] 会自动读取 ~/.claude/settings.json
    this.model = claudeCode(this.config.model || 'sonnet', {
      systemPrompt: this.config.systemPrompt,
      persistSession: false, // 我们自己管理会话持久化
      settingSources: ['user'], // 读取 ~/.claude/settings.json 配置
      streamingInput: 'always', // 总是启用流式输入
      onStreamStart: (injector) => {
        // 保存 injector 用于消息注入
        this.injector = injector;
      },
    });

    return this.model;
  }

  /**
   * 发送消息并获取流式响应
   */
  async sendMessage(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const model = await this.getModel();
    
    // 使用 Vercel AI SDK 的 streamText
    const result = streamText({ model, prompt });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk(chunk);
    }

    return fullText;
  }

  /**
   * 中途注入消息（Claude Code SDK 核心特性）
   */
  async injectMessage(message: string): Promise<void> {
    if (!this.injector) {
      throw new Error('Message injector not available');
    }
    this.injector.inject(message);
  }

  destroy(): void {
    this.model = null;
    this.injector = null;
  }
}
```

#### SessionManager 类

```typescript
// src/main/managers/SessionManager.ts
export class SessionManager {
  private sessions: Map<string, ClaudeCodeProcess> = new Map();
  private defaultConfig: ClaudeConfig;

  createSession(conversationId: string, config?: Partial<ClaudeConfig>): ClaudeCodeProcess {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const session = new ClaudeCodeProcess(conversationId, mergedConfig);
    this.sessions.set(conversationId, session);
    return session;
  }

  getOrCreateSession(conversationId: string): ClaudeCodeProcess {
    let session = this.sessions.get(conversationId);
    if (!session) {
      session = this.createSession(conversationId);
    }
    return session;
  }

  destroySession(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.destroy();
      this.sessions.delete(conversationId);
    }
  }

  destroyAll(): void {
    this.sessions.forEach((session) => session.destroy());
    this.sessions.clear();
  }
}
```

### ConfigManager - 读取 Claude 配置

ConfigManager 负责读取 `~/.claude/settings.json` 配置文件，并提供 API Key、模型等配置信息。

#### 配置文件示例

`~/.claude/settings.json` 格式示例：

```json
{
  "model": "sonnet",
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "ANTHROPIC_AUTH_TOKEN": "..."
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
- **model**: 模型名称（如 'sonnet', 'opus', 'haiku'）
- **env**: 环境变量（API Key、Auth Token 等）
- **apiKeyHelper**: 获取 API Key 的脚本路径（支持 `~` 展开）
- **permissions**: 工具权限配置（由 Claude Code SDK 自动处理）

#### ConfigManager 实现

```typescript
// src/main/managers/ConfigManager.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface ClaudeSettings {
  model?: string;
  env?: Record<string, string>;
  apiKeyHelper?: string;
  permissions?: {
    allow?: string[];
    deny?: string[];
    additionalDirectories?: string[];
    defaultMode?: string;
  };
}

export class ConfigManager {
  private settingsPath: string;
  private settings: ClaudeSettings | null = null;

  constructor() {
    this.settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  }

  /**
   * 读取 Claude settings.json
   */
  readSettings(): ClaudeSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(content);
        return this.settings!;
      }
    } catch (error) {
      console.error('Failed to read Claude settings:', error);
    }

    // 返回默认配置
    this.settings = { model: 'sonnet' };
    return this.settings;
  }

  /**
   * 获取 API Key 或 Auth Token
   * 优先级: 环境变量 > apiKeyHelper > settings.json
   */
  getApiKey(): string | undefined {
    // 1. 环境变量 - API Key
    if (process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY;
    }

    // 2. 环境变量 - Auth Token
    if (process.env.ANTHROPIC_AUTH_TOKEN) {
      return process.env.ANTHROPIC_AUTH_TOKEN;
    }

    // 3. apiKeyHelper 脚本
    const settings = this.getSettings();
    if (settings.apiKeyHelper) {
      const key = this.executeApiKeyHelper(settings.apiKeyHelper);
      if (key) return key;
    }

    // 4. settings.json 中的 env.ANTHROPIC_API_KEY
    if (settings.env?.ANTHROPIC_API_KEY) {
      return settings.env.ANTHROPIC_API_KEY;
    }

    // 5. settings.json 中的 env.ANTHROPIC_AUTH_TOKEN
    if (settings.env?.ANTHROPIC_AUTH_TOKEN) {
      return settings.env.ANTHROPIC_AUTH_TOKEN;
    }

    return undefined;
  }

  /**
   * 获取模型名称
   */
  getModel(): string {
    const settings = this.getSettings();
    return (
      process.env.ANTHROPIC_MODEL ||
      settings.model ||
      'sonnet'
    );
  }

  /**
   * 执行 apiKeyHelper 脚本获取 API Key
   */
  private executeApiKeyHelper(script: string): string | undefined {
    try {
      // 展开 ~ 路径
      const expandedScript = script.replace(/^~/, os.homedir());

      const result = execSync(expandedScript, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'], // 忽略 stderr
      });

      return result.trim();
    } catch (error) {
      console.error('Failed to execute apiKeyHelper:', error);
      return undefined;
    }
  }

  /**
   * 刷新配置（重新读取文件）
   */
  refresh(): ClaudeSettings {
    this.settings = null;
    return this.readSettings();
  }

  private getSettings(): ClaudeSettings {
    if (!this.settings) {
      return this.readSettings();
    }
    return this.settings;
  }
}
```

#### Provider 配置

Claude Code SDK 支持多种 Provider，可以通过环境变量配置：

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

**注意**：
- `settingSources: ['user']` 会自动读取 `~/.claude/settings.json`
- Claude Code SDK 会根据环境变量自动选择合适的 Provider
- 我们的 ConfigManager 主要用于应用层的配置管理


---

## IPC 通信设计

### 通道定义

```typescript
// src/types/channels.ts
export enum IPCChannel {
  // 会话管理
  CONVERSATION_CREATE = 'conversation:create',
  CONVERSATION_LIST = 'conversation:list',
  CONVERSATION_DELETE = 'conversation:delete',
  CONVERSATION_UPDATE = 'conversation:update',

  // 消息
  MESSAGE_SEND = 'message:send',
  MESSAGE_LIST = 'message:list',
  MESSAGE_STREAM = 'message:stream', // 流式响应

  // Claude 进程
  CLAUDE_INJECT = 'claude:inject',
  CLAUDE_STOP = 'claude:stop',

  // 配置
  CONFIG_GET = 'config:get',
}
```

### Preload Script（安全通信桥梁）

```typescript
// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannel } from '../types/channels';

const electronAPI = {
  // 会话管理
  createConversation: (title: string): Promise<Conversation> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_CREATE, title),

  listConversations: (): Promise<Conversation[]> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_LIST),

  deleteConversation: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_DELETE, id),

  // 消息
  sendMessage: (conversationId: string, content: string) =>
    ipcRenderer.invoke(IPCChannel.MESSAGE_SEND, conversationId, content),

  listMessages: (conversationId: string): Promise<Message[]> =>
    ipcRenderer.invoke(IPCChannel.MESSAGE_LIST, conversationId),

  // 监听流式消息
  onMessageStream: (callback: (data: any) => void) => {
    ipcRenderer.on(IPCChannel.MESSAGE_STREAM, (_event, data) => callback(data));
  },

  offMessageStream: () => {
    ipcRenderer.removeAllListeners(IPCChannel.MESSAGE_STREAM);
  },

  // 配置
  getConfig: () => ipcRenderer.invoke(IPCChannel.CONFIG_GET),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

### 主进程 IPC 处理器

```typescript
// src/main/ipc/handlers.ts
export function setupIPCHandlers(
  mainWindow: BrowserWindow,
  sessionManager: SessionManager,
  dbManager: DatabaseManager,
  configManager: ConfigManager
) {
  // 发送消息处理器
  ipcMain.handle(
    IPCChannel.MESSAGE_SEND,
    async (_event, conversationId: string, content: string) => {
      // 1. 保存用户消息
      const userMessage = { id: uuidv4(), conversationId, role: 'user', content, createdAt: Date.now() };
      await dbManager.createMessage(userMessage);

      // 2. 获取或创建 Claude 会话
      const session = sessionManager.getOrCreateSession(conversationId);

      // 3. 流式发送消息
      const assistantMessageId = uuidv4();
      let fullResponse = '';

      await session.sendMessage(content, (chunk) => {
        fullResponse += chunk;
        
        // 发送流式更新（节流 100ms）
        mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
          conversationId,
          messageId: assistantMessageId,
          chunk,
          done: false,
        });
      });

      // 4. 保存完整响应
      const assistantMessage = {
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: fullResponse,
        createdAt: Date.now(),
      };
      await dbManager.createMessage(assistantMessage);

      // 5. 发送完成信号
      mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
        conversationId,
        messageId: assistantMessageId,
        chunk: '',
        done: true,
      });

      return { userMessage, assistantMessage };
    }
  );
}
```

---

## 前端实现

### Zustand Store（状态管理）

```typescript
// src/renderer/store/useStore.ts
import { create } from 'zustand';

interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Record<string, Message[]>;
  streamingMessage: string;
  isStreaming: boolean;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setCurrentConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamingChunk: (chunk: string) => void;
  clearStreamingMessage: () => void;
}

export const useStore = create<AppState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: {},
  streamingMessage: '',
  isStreaming: false,

  // Actions 实现...
}));
```

### 自定义 Hooks

#### useConversations

```typescript
// src/renderer/hooks/useConversations.ts
export function useConversations() {
  const { conversations, setConversations, addConversation } = useStore();

  const loadConversations = useCallback(async () => {
    const convs = await window.electronAPI.listConversations();
    setConversations(convs);
  }, [setConversations]);

  const createConversation = useCallback(async (title: string = '新对话') => {
    const conv = await window.electronAPI.createConversation(title);
    addConversation(conv);
    setCurrentConversation(conv.id);
    return conv;
  }, [addConversation]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return { conversations, createConversation, removeConversation };
}
```

#### useMessages

```typescript
// src/renderer/hooks/useMessages.ts
export function useMessages(conversationId: string | null) {
  const { messages, streamingMessage, isStreaming, setMessages, appendStreamingChunk } = useStore();

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId) return;
    
    setIsStreaming(true);
    const { userMessage } = await window.electronAPI.sendMessage(conversationId, content);
    addMessage(userMessage);
  }, [conversationId]);

  // 监听流式消息
  useEffect(() => {
    const handleStreamMessage = (data) => {
      if (data.conversationId !== conversationId) return;
      
      if (data.done) {
        loadMessages();
      } else {
        appendStreamingChunk(data.chunk);
      }
    };

    window.electronAPI.onMessageStream(handleStreamMessage);
    return () => window.electronAPI.offMessageStream();
  }, [conversationId, appendStreamingChunk]);

  return { messages, streamingMessage, isStreaming, sendMessage };
}
```

### 组件结构

```
src/renderer/components/
├── Sidebar/
│   ├── ConversationList.tsx    # 会话列表
│   └── ConversationItem.tsx    # 会话项（支持删除）
└── Chat/
    ├── ChatWindow.tsx          # 聊天窗口
    ├── MessageList.tsx         # 消息列表（自动滚动）
    ├── MessageItem.tsx         # 消息项
    └── InputBox.tsx            # 输入框（支持快捷键）
```

### UI 样式设计

- **简洁现代风格**：类似 ChatGPT/Claude 官方界面
- **左侧边栏**：暗色背景（#2c2c2c），会话列表
- **右侧聊天**：白色背景，清晰的消息气泡
- **流式动画**：脉冲效果提示正在生成
- **自动滚动**：消息更新时自动滚动到底部

---

## 项目结构

```
acp-client/
├── src/
│   ├── main/                      # 主进程
│   │   ├── main.ts                # 入口（集成所有管理器）
│   │   ├── preload.ts             # Preload Script（IPC 暴露）
│   │   ├── managers/
│   │   │   ├── DatabaseManager.ts # SQLite 数据库管理
│   │   │   ├── ConfigManager.ts   # 配置读取（~/.claude/settings.json）
│   │   │   └── SessionManager.ts  # Claude 会话管理
│   │   ├── claude/
│   │   │   └── ClaudeCodeProcess.ts # Claude Code 进程封装
│   │   └── ipc/
│   │       └── handlers.ts        # IPC 处理器
│   ├── renderer/                  # 渲染进程
│   │   ├── App.tsx                # 主应用组件
│   │   ├── store/
│   │   │   └── useStore.ts        # Zustand Store
│   │   ├── hooks/
│   │   │   ├── useConversations.ts
│   │   │   └── useMessages.ts
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   │   ├── ConversationList.tsx
│   │   │   │   └── ConversationItem.tsx
│   │   │   └── Chat/
│   │   │       ├── ChatWindow.tsx
│   │   │       ├── MessageList.tsx
│   │   │       ├── MessageItem.tsx
│   │   │       └── InputBox.tsx
│   │   └── styles/
│   │       └── App.css            # 全局样式
│   └── types/
│       ├── channels.ts            # IPC 通道定义
│       ├── conversation.ts        # 数据类型
│       └── global.d.ts            # 全局类型声明
├── release/app/
│   └── package.json               # 生产依赖（原生模块）
├── package.json                   # 开发依赖
├── tsconfig.json                  # TypeScript 配置
└── README_ACP.md                  # 项目文档
```

---

## 实施步骤

### 第 1 步：初始化项目

```bash
# 克隆脚手架
git clone --depth=1 \
  https://github.com/electron-react-boilerplate/electron-react-boilerplate \
  acp-client

cd acp-client
npm install
```

### 第 2 步：安装依赖

```bash
# 开发依赖（根目录）
npm install --save-dev @types/uuid

# 生产依赖（release/app）
cd release/app
npm install @anthropic-ai/claude-agent-sdk ai sqlite3 uuid zustand
npm run postinstall  # 编译原生模块
cd ../..
```

### 第 3 步：实现数据层

- ✅ 创建 `DatabaseManager.ts`
- ✅ 定义 SQLite schema
- ✅ 实现 CRUD 操作

### 第 4 步：实现 Claude 集成

- ✅ `ConfigManager.ts` 读取 `~/.claude/settings.json`
- ✅ `ClaudeCodeProcess.ts` 封装 SDK
- ✅ `SessionManager.ts` 管理多进程

### 第 5 步：实现 IPC 通信

- ✅ 定义 `IPCChannel` 枚举
- ✅ 编写 `preload.ts`
- ✅ 实现 `handlers.ts`

### 第 6 步：实现前端 UI

- ✅ Zustand store
- ✅ 自定义 Hooks
- ✅ React 组件
- ✅ 样式设计

### 第 7 步：测试与优化

- 多会话并发测试
- 内存泄漏检查
- UI 性能优化
- 流式响应节流

---

## 关键技术难点

### 1. 多进程管理

**挑战**：每个会话启动独立的 Claude Code 进程

**解决方案**：
- SessionManager 维护 `Map<conversationId, ClaudeCodeProcess>`
- 会话关闭时主动调用 `destroy()` 清理资源
- 应用退出时 `destroyAll()` 清理所有进程

### 2. 流式消息处理

**挑战**：Claude 响应是流式的，需要实时更新 UI

**解决方案**：
- 使用 `streamText` API 的 `textStream` 迭代器
- 主进程通过 `webContents.send()` 发送流式更新
- 渲染进程监听 `MESSAGE_STREAM` 事件，追加 chunk
- **节流优化**：每 100ms 最多发送一次，避免频繁渲染

### 3. 数据库路径管理

**挑战**：开发/生产环境的数据库路径不同

**解决方案**：
```typescript
const isDebug = process.env.NODE_ENV === 'development';
const dbPath = isDebug
  ? path.join(__dirname, '../../sql', databaseName)  // 开发模式：项目目录
  : path.join(app.getPath('userData'), databaseName); // 生产模式：用户数据目录
```

### 4. 会话恢复

**挑战**：支持从数据库恢复历史会话

**解决方案**：
- 保存 `claudeSessionId` 到数据库
- SessionManager 延迟创建进程（首次发送消息时）
- 读取历史消息时不启动 Claude 进程

### 5. 原生模块编译

**挑战**：SQLite3 是原生模块，需要针对 Electron 编译

**解决方案**：
- 安装到 `release/app/package.json`
- 使用 `electron-rebuild` 重新编译
- postinstall 脚本自动处理

---

## 扩展功能

### 已实现 ✅

- [x] 多会话并行
- [x] 流式消息响应
- [x] 完整会话记录持久化
- [x] 简洁现代的 UI
- [x] 快捷键支持（Cmd/Ctrl + Enter）
- [x] 自动滚动到最新消息
- [x] 节流优化

### 计划中 🔮

- [ ] **工具调用可视化**
  - 展示 Claude Code 执行的工具（读文件、写文件、执行命令）
  - 工具输入/输出折叠展示
  - 状态跟踪（pending/success/error）

- [ ] **全文搜索**
  - 搜索历史会话内容
  - 高亮匹配结果
  - 快捷键触发

- [ ] **Token 使用统计**
  - 每个会话的 Token 消耗
  - 总计统计和趋势图
  - 成本估算

- [ ] **主题切换**
  - 亮色/暗色模式
  - 自定义配色方案
  - 跟随系统主题

- [ ] **导出功能**
  - 导出会话为 Markdown
  - 支持带/不带工具调用
  - 批量导出

- [ ] **API Key 安全存储**
  - 使用系统 Keychain (macOS)
  - Credential Manager (Windows)
  - 加密存储

- [ ] **多 Provider 支持**
  - Amazon Bedrock
  - Google Vertex AI
  - Microsoft Foundry
  - 自定义 LLM Gateway

- [ ] **MCP Server 集成**
  - 支持加载 MCP 工具
  - 动态添加/移除 MCP 服务器
  - 工具权限管理

---

## 总结

### 核心亮点

1. **真正的多会话并行**：每个会话独立的 Claude Code 进程，互不干扰
2. **流式响应体验**：实时显示 Claude 的思考过程
3. **完整数据持久化**：SQLite 保存所有会话，支持离线查看
4. **配置灵活性**：兼容 Claude Code 官方配置文件
5. **安全的 IPC 通信**：使用 contextBridge，遵循 Electron 最佳实践
6. **现代化 UI**：简洁、响应式、用户友好

### 技术创新

- **SDK 封装**：将 Claude Agent SDK 封装为进程类，便于管理
- **流式节流**：避免频繁更新 UI 导致性能问题
- **延迟创建**：只在需要时创建 Claude 进程，节省资源
- **两层 package.json**：优化打包体积

### 适用场景

- 自定义 AI 编码助手
- 团队内部 Claude 客户端
- AI Agent 编排工具
- 多 Agent 协作平台

---

## 参考资源

### 官方文档

- [Anthropic Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)

### 技术文章

- [ACP (Agent Client Protocol) 详解](https://code.claude.com/docs/en/acp)
- [Electron IPC 最佳实践](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [SQLite in Electron](https://github.com/mapbox/node-sqlite3)

### 相关项目

- [Claude Code Official](https://code.claude.com/)
- [Claude Agent SDK Demos](https://github.com/anthropics/claude-agent-sdk-demos)

---

**文档版本**: v1.0  
**作者**: ACP Client Development Team  
**最后更新**: 2026/01/30
