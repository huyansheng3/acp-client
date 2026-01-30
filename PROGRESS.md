# ACP Client - 开发进度记录

> 最后更新时间：2026/01/30 14:58

## 📊 项目完成度：85%

### 核心功能完成情况

- ✅ **后端实现**：100%
- ✅ **前端实现**：100%
- ✅ **文档完善**：100%
- ⏳ **测试验证**：0%
- ⏳ **打包部署**：0%

---

## ✅ 已完成的工作

### 第一阶段：核心基础层（100%）

#### 1. 后端核心模块

##### ✅ ClaudeCodeProcess.ts - Claude Code Agent 封装
**位置**：`src/main/claude/ClaudeCodeProcess.ts`

**功能**：
- 使用 `@anthropic-ai/claude-agent-sdk` 与 Claude Code Agent 通信
- 支持流式消息响应（基于 Vercel AI SDK）
- 支持消息注入（Message Injection）
- 延迟初始化（首次发送消息时创建 Agent）
- 自动读取 `~/.claude/settings.json` 配置
- 支持多 Provider（Anthropic、Amazon Bedrock、Google Vertex AI）

**关键代码**：
```typescript
// 创建 Claude Code Agent
this.model = claudeCode(this.config.model || 'sonnet', {
  systemPrompt: this.config.systemPrompt,
  persistSession: false,
  settingSources: ['user'], // 自动读取 ~/.claude/settings.json
  streamingInput: 'always',
  onStreamStart: (injector) => {
    this.injector = injector;
  },
});

// 流式发送消息
const result = streamText({ model, prompt });
for await (const chunk of result.textStream) {
  fullText += chunk;
  onChunk(chunk);
}
```

##### ✅ ConfigManager.ts - 配置管理
**位置**：`src/main/managers/ConfigManager.ts`

**功能**：
- 读取 `~/.claude/settings.json` 配置文件
- 支持 API Key 多种获取方式（优先级：环境变量 > apiKeyHelper > settings.json）
- 支持执行 `apiKeyHelper` 脚本动态获取 Key
- 支持配置刷新

**API Key 优先级**：
1. `ANTHROPIC_API_KEY` 环境变量
2. `ANTHROPIC_AUTH_TOKEN` 环境变量
3. `apiKeyHelper` 脚本执行结果
4. `settings.json` 中的 `env.ANTHROPIC_API_KEY`
5. `settings.json` 中的 `env.ANTHROPIC_AUTH_TOKEN`

##### ✅ SessionManager.ts - 会话管理
**位置**：`src/main/managers/SessionManager.ts`

**功能**：
- 管理多个独立的 Claude Code Agent 实例
- 每个会话独立的配置和上下文
- 支持会话创建、获取、销毁
- 支持批量销毁所有会话

##### ✅ DatabaseManager.ts - 数据库管理
**位置**：`src/main/managers/DatabaseManager.ts`

**功能**：
- SQLite 本地数据库
- 会话表（conversations）
- 消息表（messages）
- 工具调用记录表（tool_calls）
- 完整的 CRUD 操作

##### ✅ IPC 通信处理器
**位置**：`src/main/ipc/handlers.ts`

**功能**：
- 会话管理（创建、列表、更新、删除）
- 消息发送（流式响应 + 节流优化）
- 消息列表获取
- Claude 进程管理（注入消息、停止会话）
- 配置获取

**流式消息处理**（带节流优化）：
```typescript
const THROTTLE_MS = 100; // 每 100ms 最多发送一次
let lastSendTime = Date.now();

await session.sendMessage(content, (chunk) => {
  fullResponse += chunk;
  
  const now = Date.now();
  if (now - lastSendTime >= THROTTLE_MS) {
    mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
      conversationId,
      messageId: assistantMessageId,
      chunk,
      done: false,
    });
    lastSendTime = now;
  }
});
```

##### ✅ 主进程集成
**位置**：`src/main/main.ts`

**功能**：
- 初始化 DatabaseManager
- 初始化 ConfigManager
- 初始化 SessionManager（读取配置）
- 设置 IPC 处理器
- 应用退出时清理所有会话

##### ✅ Preload Script
**位置**：`src/main/preload.ts`

**功能**：
- 安全的 IPC 通信桥梁（使用 contextBridge）
- 暴露 electronAPI 给渲染进程
- 支持会话管理、消息发送、流式监听等 API

---

### 第二阶段：前端实现（100%）

#### 2. 状态管理

##### ✅ Zustand Store
**位置**：`src/renderer/store/useStore.ts`

**状态**：
- `conversations` - 会话列表
- `currentConversationId` - 当前选中的会话
- `messages` - 消息列表（按 conversationId 分组）
- `streamingMessage` - 流式接收的消息
- `isStreaming` - 是否正在接收流式消息
- `streamingConversationId` - 正在流式响应的会话 ID
- `streamingMessageId` - 流式消息 ID

**Actions**：
- 会话管理：`setConversations`, `addConversation`, `setCurrentConversation`, `deleteConversation`, `updateConversation`
- 消息管理：`setMessages`, `addMessage`, `appendStreamingChunk`, `startStreaming`, `finishStreaming`, `clearStreamingMessage`

#### 3. 自定义 Hooks

##### ✅ useConversations Hook
**位置**：`src/renderer/hooks/useConversations.ts`

**功能**：
- 加载会话列表（自动初始化）
- 创建新会话
- 删除会话
- 更新会话（标题、状态）
- 切换当前会话
- 刷新会话列表

##### ✅ useMessages Hook
**位置**：`src/renderer/hooks/useMessages.ts`

**功能**：
- 加载消息列表（自动初始化）
- 发送消息
- 监听流式消息（自动追加 chunk）
- 处理流式完成（更新 store）
- 错误处理

**流式消息处理**：
```typescript
useEffect(() => {
  const handleMessageStream = (data) => {
    if (data.conversationId !== conversationId) return;

    if (data.done) {
      // 流式响应完成
      const completedMessage = {
        id: data.messageId,
        conversationId: data.conversationId,
        role: 'assistant',
        content: streamingMessage,
        createdAt: Date.now(),
      };
      finishStreaming(data.conversationId, completedMessage);
    } else {
      // 追加流式数据
      appendStreamingChunk(data.chunk);
    }
  };

  window.electronAPI.onMessageStream(handleMessageStream);
  return () => window.electronAPI.offMessageStream();
}, [conversationId, streamingMessage]);
```

#### 4. UI 组件

##### ✅ ConversationList - 会话列表
**位置**：`src/renderer/components/Sidebar/ConversationList.tsx`

**功能**：
- 显示所有会话
- 创建新会话按钮
- 空状态提示
- 自动加载会话列表

##### ✅ ConversationItem - 会话项
**位置**：`src/renderer/components/Sidebar/ConversationItem.tsx`

**功能**：
- 显示会话标题和更新时间
- 点击切换会话
- 重命名会话（编辑模式）
- 删除会话（带确认）
- 高亮当前选中的会话
- 智能时间显示（今天显示时间、本周显示星期、更早显示日期）

##### ✅ ChatWindow - 聊天窗口
**位置**：`src/renderer/components/Chat/ChatWindow.tsx`

**功能**：
- 显示消息列表
- 显示输入框
- 自动滚动到底部

##### ✅ MessageList - 消息列表
**位置**：`src/renderer/components/Chat/MessageList.tsx`

**功能**：
- 渲染所有消息
- 显示流式消息（带动画）
- 空状态提示

##### ✅ MessageItem - 消息项
**位置**：`src/renderer/components/Chat/MessageItem.tsx`

**功能**：
- 显示用户/助手消息
- 显示头像（用户 👤 / 助手 🤖）
- 显示时间戳
- 显示元数据（model、tokens）
- 区分用户消息和助手消息的样式

##### ✅ InputBox - 输入框
**位置**：`src/renderer/components/Chat/InputBox.tsx`

**功能**：
- 多行文本输入（自动调整高度）
- Cmd/Ctrl + Enter 快捷键发送
- 发送按钮
- 禁用状态（流式响应时）
- 自动聚焦

#### 5. 样式文件

##### ✅ 已完成的 CSS 文件
- `src/renderer/styles/App.css` - 全局样式
- `src/renderer/components/Sidebar/ConversationList.css` - 会话列表样式
- `src/renderer/components/Sidebar/ConversationItem.css` - 会话项样式
- `src/renderer/components/Chat/ChatWindow.css` - 聊天窗口样式
- `src/renderer/components/Chat/MessageList.css` - 消息列表样式
- `src/renderer/components/Chat/MessageItem.css` - 消息项样式（含流式动画）
- `src/renderer/components/Chat/InputBox.css` - 输入框样式

**设计风格**：
- 左侧边栏：暗色背景（#2c2c2c）
- 右侧聊天：白色背景（#fff）
- 用户消息：蓝色气泡（#007aff）
- 助手消息：灰色气泡（#f0f0f0）
- 流式动画：脉冲效果 + 点点点动画

---

### 第三阶段：文档和示例（100%）

#### 6. 技术文档

##### ✅ AGENTS.md - 技术方案文档
**内容**：
- ACP 通信架构说明
- ClaudeCodeProcess 详细实现
- ConfigManager 完整实现
- Provider 配置示例
- `~/.claude/settings.json` 配置说明
- IPC 通信设计
- 数据模型
- 项目结构

##### ✅ README_SETUP.md - 快速开始指南
**内容**：
- 架构说明
- 环境准备
- 安装步骤
- 配置说明（详细的配置文件示例）
- 使用指南
- 常见问题解答

##### ✅ IMPLEMENTATION_SUMMARY.md - 实现总结
**内容**：
- 已完成工作清单
- 核心实现方式
- 下一步工作计划
- 技术验证要点
- 注意事项

##### ✅ PROGRESS.md - 开发进度记录（本文件）

#### 7. 示例和配置

##### ✅ examples/usage-examples.ts
**内容**：
- 示例 1：直接使用 ClaudeCodeProcess
- 示例 2：使用 SessionManager 管理多会话
- 示例 3：消息注入（人工干预）
- 示例 4：错误处理
- 示例 5：多 Provider 配置

##### ✅ .claude/settings.example.json
**内容**：
- 配置文件模板
- 包含 model、env、apiKeyHelper、permissions 等配置

##### ✅ scripts/get-claude-key.example.sh
**内容**：
- 从系统密钥链获取 API Key 的脚本示例（macOS）
- 使用说明

---

## 🎯 核心技术实现

### ACP 通信架构

```
你的 ACP Client (本应用)
    ↓ @anthropic-ai/claude-agent-sdk
Claude Code Agent (本地/远程进程)
    ↓ ACP 协议 (stdin/stdout JSON-RPC)
Anthropic API / Amazon Bedrock / Google Vertex AI
```

**关键特性**：
- ❌ **不是直接调用 Anthropic API**
- ✅ **通过 Claude Code SDK 与 Agent 通信**
- ✅ **SDK 自动处理**：配置读取、权限管理、工具调用
- ✅ **settingSources: ['user']** 自动读取 `~/.claude/settings.json`

### Provider 支持

通过环境变量配置不同的 Provider：

```bash
# 1. Anthropic API (默认)
export ANTHROPIC_API_KEY="sk-ant-..."

# 2. Amazon Bedrock
export AWS_REGION="us-west-2"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# 3. Google Vertex AI
export GOOGLE_VERTEX_PROJECT_ID="..."
export GOOGLE_VERTEX_LOCATION="us-central1"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

### 流式消息处理

**主进程（节流优化）**：
```typescript
const THROTTLE_MS = 100; // 每 100ms 最多发送一次
await session.sendMessage(content, (chunk) => {
  fullResponse += chunk;
  
  const now = Date.now();
  if (now - lastSendTime >= THROTTLE_MS) {
    mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
      conversationId,
      messageId: assistantMessageId,
      chunk,
      done: false,
    });
    lastSendTime = now;
  }
});
```

**渲染进程（实时更新）**：
```typescript
useEffect(() => {
  const handleMessageStream = (data) => {
    if (data.done) {
      finishStreaming(data.conversationId, completedMessage);
    } else {
      appendStreamingChunk(data.chunk);
    }
  };
  
  window.electronAPI.onMessageStream(handleMessageStream);
  return () => window.electronAPI.offMessageStream();
}, [conversationId, streamingMessage]);
```

---

## 📂 项目文件结构

```
acp-client/
├── src/
│   ├── main/                              # 主进程
│   │   ├── main.ts                        # ✅ 入口（已集成）
│   │   ├── preload.ts                     # ✅ Preload Script
│   │   ├── managers/
│   │   │   ├── DatabaseManager.ts         # ✅ SQLite 数据库管理
│   │   │   ├── ConfigManager.ts           # ✅ 配置读取
│   │   │   └── SessionManager.ts          # ✅ Claude 会话管理
│   │   ├── claude/
│   │   │   └── ClaudeCodeProcess.ts       # ✅ Claude Code Agent 封装
│   │   └── ipc/
│   │       └── handlers.ts                # ✅ IPC 处理器
│   ├── renderer/                          # 渲染进程
│   │   ├── App.tsx                        # ✅ 主应用组件
│   │   ├── store/
│   │   │   └── useStore.ts                # ✅ Zustand Store
│   │   ├── hooks/
│   │   │   ├── useConversations.ts        # ✅ 会话管理 Hook
│   │   │   └── useMessages.ts             # ✅ 消息管理 Hook
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   │   ├── ConversationList.tsx   # ✅ 会话列表组件
│   │   │   │   ├── ConversationList.css   # ✅
│   │   │   │   ├── ConversationItem.tsx   # ✅ 会话项组件
│   │   │   │   └── ConversationItem.css   # ✅
│   │   │   └── Chat/
│   │   │       ├── ChatWindow.tsx         # ✅ 聊天窗口
│   │   │       ├── ChatWindow.css         # ✅
│   │   │       ├── MessageList.tsx        # ✅ 消息列表
│   │   │       ├── MessageList.css        # ✅
│   │   │       ├── MessageItem.tsx        # ✅ 消息项
│   │   │       ├── MessageItem.css        # ✅
│   │   │       ├── InputBox.tsx           # ✅ 输入框
│   │   │       └── InputBox.css           # ✅
│   │   ├── styles/
│   │   │   └── App.css                    # ✅ 全局样式
│   │   └── preload.d.ts                   # ✅ 类型声明
│   └── types/
│       ├── channels.ts                    # ✅ IPC 通道定义
│       ├── conversation.ts                # ✅ 数据类型
│       └── global.d.ts                    # ✅ 全局类型声明
├── examples/
│   └── usage-examples.ts                  # ✅ 使用示例
├── scripts/
│   └── get-claude-key.example.sh          # ✅ API Key 获取脚本示例
├── .claude/
│   └── settings.example.json              # ✅ 配置文件模板
├── release/app/
│   └── package.json                       # ✅ 生产依赖
├── package.json                           # ✅ 开发依赖
├── AGENTS.md                              # ✅ 技术方案文档
├── README_SETUP.md                        # ✅ 快速开始指南
├── IMPLEMENTATION_SUMMARY.md              # ✅ 实现总结
└── PROGRESS.md                            # ✅ 本文件（开发进度记录）
```

---

## ⏳ 待完成的工作

### 优先级 1 - 测试验证（0%）

#### 1. 功能测试
- [ ] **端到端测试**
  - 创建会话
  - 发送消息
  - 接收流式响应
  - 删除会话
  
- [ ] **多会话并发测试**
  - 同时在多个会话中发送消息
  - 验证会话隔离性
  - 验证流式消息正确路由

- [ ] **配置测试**
  - 测试 `~/.claude/settings.json` 读取
  - 测试 apiKeyHelper 脚本执行
  - 测试环境变量优先级

- [ ] **数据库测试**
  - 测试会话持久化
  - 测试消息持久化
  - 测试数据库迁移

#### 2. 性能测试
- [ ] **流式消息性能**
  - 测试节流效果（100ms）
  - 测试长消息渲染性能
  - 测试内存占用

- [ ] **数据库性能**
  - 测试大量会话加载速度
  - 测试长会话消息加载速度
  - 测试查询优化

#### 3. 错误处理测试
- [ ] **网络错误**
  - API Key 无效
  - 网络连接失败
  - 超时处理

- [ ] **数据库错误**
  - 数据库文件损坏
  - 写入失败
  - 并发冲突

---

### 优先级 2 - 优化改进（0%）

#### 1. UI/UX 优化
- [ ] **加载状态**
  - 会话列表加载骨架屏
  - 消息加载骨架屏
  - 发送消息 loading 状态

- [ ] **错误提示**
  - Toast 通知
  - 错误边界
  - 友好的错误信息

- [ ] **快捷键**
  - 全局快捷键（创建会话、搜索等）
  - 会话导航快捷键
  - 消息操作快捷键

#### 2. 功能增强
- [ ] **消息编辑**
  - 编辑已发送的消息
  - 重新发送消息

- [ ] **消息复制**
  - 一键复制消息内容
  - 复制为 Markdown

- [ ] **会话导出**
  - 导出为 Markdown
  - 导出为 JSON

---

### 优先级 3 - 扩展功能（0%）

#### 1. 工具调用可视化
- [ ] 显示 Claude Code 执行的工具
- [ ] 工具输入/输出展示
- [ ] 工具状态跟踪（pending/success/error）

#### 2. 搜索功能
- [ ] 会话搜索
- [ ] 消息全文搜索
- [ ] 高亮匹配结果

#### 3. Token 统计
- [ ] 单个会话 Token 消耗
- [ ] 总计 Token 统计
- [ ] 成本估算

#### 4. 主题切换
- [ ] 亮色/暗色模式
- [ ] 自定义配色方案
- [ ] 跟随系统主题

#### 5. MCP Server 集成
- [ ] 支持加载 MCP 工具
- [ ] 动态添加/移除 MCP 服务器
- [ ] 工具权限管理

---

### 优先级 4 - 打包部署（0%）

#### 1. 构建优化
- [ ] 生产环境打包配置
- [ ] 代码压缩优化
- [ ] 资源优化

#### 2. 平台打包
- [ ] macOS 打包（.dmg）
- [ ] Windows 打包（.exe）
- [ ] Linux 打包（.AppImage）

#### 3. 自动更新
- [ ] 配置 electron-updater
- [ ] 版本检测
- [ ] 自动下载更新

---

## 🚨 已知问题

### 1. 端口占用
**现象**：启动时提示端口 1212 被占用

**解决方案**：
```bash
# 使用其他端口启动
PORT=4343 npm start
```

### 2. SQLite 原生模块
**现象**：可能需要重新编译 SQLite3 原生模块

**解决方案**：
```bash
cd release/app
npm run rebuild
```

### 3. 流式消息延迟
**现象**：流式消息可能有 100ms 延迟（节流优化）

**说明**：这是预期行为，用于优化性能

---

## 📝 开发说明

### 启动开发环境

```bash
# 1. 安装依赖
npm install
cd release/app && npm install && cd ../..

# 2. 配置 Claude
# 创建 ~/.claude/settings.json
{
  "model": "sonnet",
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-api03-..."
  }
}

# 3. 启动应用
npm start
```

### 开发模式特性

- **热重载**：修改代码自动刷新
- **开发工具**：自动打开 React DevTools
- **数据库位置**：`src/sql/acp-client.sqlite`（开发模式）
- **日志输出**：终端实时输出

### 生产模式

```bash
# 构建
npm run build

# 打包
npm run package

# 打包文件位置
release/build/
```

---

## 🎉 里程碑

### ✅ 2026/01/30 - 核心功能完成
- 完成后端所有模块
- 完成前端所有组件
- 完成技术文档
- 完成使用示例

### ⏳ 下一个里程碑：测试完成
**目标**：2026/02/05
- 完成功能测试
- 完成性能测试
- 修复所有已知问题

### ⏳ 第三个里程碑：首个发布版本
**目标**：2026/02/15
- 完成打包部署
- 发布 v1.0.0 版本
- 编写用户文档

---

## 📚 相关文档

- **技术方案**：[AGENTS.md](./AGENTS.md)
- **快速开始**：[README_SETUP.md](./README_SETUP.md)
- **实现总结**：[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **使用示例**：[examples/usage-examples.ts](./examples/usage-examples.ts)

---

## 👥 贡献者

- **核心开发**：ACP Client Development Team
- **技术支持**：Claude Code SDK Team

---

**文档版本**: v1.0  
**最后更新**: 2026/01/30 14:58
