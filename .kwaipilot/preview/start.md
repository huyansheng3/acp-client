# Electron React Boilerplate 启动指南

## 项目概述
基于 Electron + React + TypeScript + Webpack 的桌面应用开发模板。

## . - electron-react-boilerplate

### 快速启动

```bash
npm start
```

**启动后访问**：Electron 桌面应用窗口将自动打开

> **注意**：首次启动会自动执行 `postinstall` 脚本构建 DLL 文件，可能需要较长时间。如遇到启动失败，请先确保依赖已正确安装。

**常见启动问题排查**：
- 如果提示 DLL 文件缺失，运行：`npm run build:dll`
- 如果端口 1212 被占用，设置环境变量：`PORT=其他端口 npm start`
- 如果遇到 Node 模块错误，尝试：`npm run rebuild`

```yaml
subProjectPath: .
command: npm start
cwd: .
port: 1212
previewUrl: null
description: Electron 桌面应用，开发服务器运行在端口 1212，应用窗口自动打开
```
