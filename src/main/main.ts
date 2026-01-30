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
  const apiKey = configManager.getApiKey();
  
  // 构建 Claude 配置
  let claudeConfig: any = {
    model: configManager.getModel(),
  };
  
  // 设置 base URL（如果有）
  if (config.env?.ANTHROPIC_BASE_URL) {
    claudeConfig.baseUrl = config.env.ANTHROPIC_BASE_URL;
  }
  
  // 设置认证信息
  if (apiKey) {
    // 检查是认证 token 还是 API key
    // settings.json 中使用 ANTHROPIC_AUTH_TOKEN 的情况
    if (config.env?.ANTHROPIC_AUTH_TOKEN) {
      claudeConfig.authToken = apiKey;
    } else {
      claudeConfig.apiKey = apiKey;
    }
  }

  logger.info('Claude config initialized', {
    model: claudeConfig.model,
    hasApiKey: !!claudeConfig.apiKey,
    hasAuthToken: !!claudeConfig.authToken,
    baseUrl: claudeConfig.baseUrl || 'default',
  });
  
  sessionManager = new SessionManager(claudeConfig);

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

app.on('window-all-closed', () => {
  // 清理资源
  if (sessionManager) {
    sessionManager.destroyAll();
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
