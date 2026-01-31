/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { DatabaseManager } from './managers/DatabaseManager';
import { ConfigManager } from './managers/ConfigManager';
import { SessionManager } from './managers/SessionManager';
import { setupIPCHandlers } from './ipc/handlers';
import { initLogger, createLogger, getLogDirectory } from './utils/logger';

// 初始化日志系统
initLogger();
const logger = createLogger('main');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

// 初始化管理器
const dbManager = new DatabaseManager();
const configManager = new ConfigManager();
let sessionManager: SessionManager | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 初始化 SessionManager 和 IPC 处理器
  const config = configManager.readSettings();
  
  // 从 ~/.claude/settings.json 读取 API Key 并构建环境变量
  const apiKey = configManager.getApiKey();
  const agentEnv: Record<string, string> = {};
  
  if (apiKey) {
    // 检查是 Auth Token 还是 API Key
    if (config.env?.ANTHROPIC_AUTH_TOKEN) {
      agentEnv.ANTHROPIC_AUTH_TOKEN = apiKey;
    } else {
      agentEnv.ANTHROPIC_API_KEY = apiKey;
    }
  }
  
  // 合并 settings.json 中的其他环境变量
  if (config.env) {
    Object.entries(config.env).forEach(([key, value]) => {
      if (!agentEnv[key]) {
        agentEnv[key] = value;
      }
    });
  }
  
  // 构建 ACP 配置
  // 默认使用 @zed-industries/claude-code-acp 适配器
  // 需要先安装: npm install -g @zed-industries/claude-code-acp
  const acpConfig = {
    // Agent 启动命令，可通过配置文件自定义
    agentCommand: config.agentCommand || ['claude-code-acp'],
    workingDir: process.cwd(),
    clientInfo: {
      name: 'acp-client',
      version: '1.0.0',
    },
    // 注入环境变量到 Agent 子进程
    env: agentEnv,
  };

  logger.info('ACP config initialized', {
    agentCommand: acpConfig.agentCommand,
    workingDir: acpConfig.workingDir,
    hasApiKey: !!agentEnv.ANTHROPIC_API_KEY,
    hasAuthToken: !!agentEnv.ANTHROPIC_AUTH_TOKEN,
  });
  
  sessionManager = new SessionManager({ acpConfig });
  sessionManager.setMainWindow(mainWindow);

  setupIPCHandlers(mainWindow, sessionManager, dbManager, configManager);

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', async () => {
  // 清理资源
  if (sessionManager) {
    await sessionManager.destroyAll();
  }
  dbManager.close();

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    // 初始化数据库
    await dbManager.initialize();

    logger.info('Application starting', {
      logDirectory: getLogDirectory(),
      env: process.env.NODE_ENV,
    });
    
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
