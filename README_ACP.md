# ACP Client - 快速开始

ACP Client 是一个基于 Electron 的桌面应用，通过 @anthropic-ai/claude-agent-sdk 与 Claude Code 进行通信。

## 技术栈

- **Electron** - 桌面应用框架
- **React** - UI 框架
- **TypeScript** - 类型系统
- **Zustand** - 状态管理
- **SQLite3** - 数据持久化
- **@anthropic-ai/claude-agent-sdk** - Claude Code 集成

## 前置要求

1. **Node.js** >= 18
2. **Claude API Key** 或配置 `~/.claude/settings.json`

## 安装依赖

```bash
# 安装开发依赖
npm install

# 安装生产依赖并编译原生模块
cd release/app
npm install
cd ../..
```

## 配置 Claude

### 方式 1: 环境变量

```bash
export ANTHROPIC_API_KEY=sk-xxx
```

### 方式 2: 配置文件

创建 `~/.claude/settings.json`:

```json
{
  "model": "sonnet",
  "env": {
    "ANTHROPIC_API_KEY": "sk-xxx"
  }
}
```

## 启动应用

```bash
# 开发模式
npm start

# 打包生产版本
npm run package
```

## 项目结构

```
src/
├── main/                      # 主进程
│   ├── main.ts                # 主进程入口
│   ├── preload.ts             # 预加载脚本
│   ├── managers/              # 管理器
│   │   ├── DatabaseManager.ts # 数据库管理
│   │   ├── ConfigManager.ts   # 配置管理
│   │   └── SessionManager.ts  # 会话管理
│   ├── claude/                # Claude 集成
│   │   └── ClaudeCodeProcess.ts
│   └── ipc/                   # IPC 通信
│       └── handlers.ts        # 处理器
├── renderer/                  # 渲染进程
│   ├── App.tsx                # 应用入口
│   ├── store/                 # Zustand Store
│   ├── hooks/                 # React Hooks
│   ├── components/            # 组件
│   │   ├── Sidebar/           # 侧边栏
│   │   └── Chat/              # 聊天窗口
│   └── styles/                # 样式
└── types/                     # 类型定义
    ├── channels.ts            # IPC 通道
    ├── conversation.ts        # 数据类型
    └── global.d.ts            # 全局声明
```

## 功能特性

### ✅ 已实现

- 多会话并行（每个会话独立 Claude Code 进程）
- 流式消息响应
- 会话持久化（SQLite）
- 简洁现代的 UI
- 快捷键支持（Cmd/Ctrl + Enter 发送）

### 🔮 计划中

- 工具调用可视化
- 全文搜索
- Token 使用统计
- 主题切换
- 导出会话
- 多 Provider 支持

## 数据库

应用使用 SQLite 存储会话和消息：

- **开发模式**: `./sql/acp-client.sqlite`
- **生产模式**: `~/Library/Application Support/acp-client/acp-client.sqlite` (macOS)

## 故障排查

### 问题: SQLite 编译失败

```bash
cd release/app
npm run rebuild
```

### 问题: Claude API 连接失败

检查：
1. API Key 是否正确配置
2. 网络连接是否正常
3. 查看控制台错误日志

### 问题: 消息流式显示异常

检查主进程日志，确保 IPC 通信正常。

## 开发

### 热重载

开发模式下，React 代码支持热重载（HMR），主进程代码修改需要重启。

### 调试

- **渲染进程**: 使用 Chrome DevTools (Cmd/Ctrl + Shift + I)
- **主进程**: 查看终端输出

## 许可证

MIT
