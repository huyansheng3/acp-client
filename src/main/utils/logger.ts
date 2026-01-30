import log from 'electron-log';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志来源
 */
export type LogSource = 'main' | 'renderer';

/**
 * 日志目录路径
 */
export function getLogDirectory(): string {
  const userDataPath = app.getPath('userData');
  const logDir = path.join(userDataPath, 'logs');
  
  // 确保目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  return logDir;
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 初始化日志系统
 */
export function initLogger(): void {
  const logDir = getLogDirectory();
  const dateStr = getDateString();

  // 配置主进程日志文件
  log.transports.file.resolvePathFn = () => {
    return path.join(logDir, `main-${dateStr}.log`);
  };

  // 日志格式
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  
  // 同时输出到控制台
  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';
  
  // 设置日志级别
  log.transports.file.level = 'debug';
  log.transports.console.level = 'debug';

  // 日志文件大小限制 (10MB)
  log.transports.file.maxSize = 10 * 1024 * 1024;

  console.log(`[Logger] Initialized. Log directory: ${logDir}`);
}

/**
 * 主进程 Logger 类
 */
class MainLogger {
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  private formatMessage(message: string, data?: any): string {
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[main/${this.source}] ${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    log.debug(this.formatMessage(message, data));
  }

  info(message: string, data?: any): void {
    log.info(this.formatMessage(message, data));
  }

  warn(message: string, data?: any): void {
    log.warn(this.formatMessage(message, data));
  }

  error(message: string, data?: any): void {
    log.error(this.formatMessage(message, data));
  }
}

/**
 * 渲染进程日志写入（通过 IPC 调用）
 */
export function writeRendererLog(
  level: LogLevel,
  source: string,
  message: string,
  data?: any
): void {
  const logDir = getLogDirectory();
  const dateStr = getDateString();
  const timestamp = formatTimestamp();
  const logFile = path.join(logDir, `renderer-${dateStr}.log`);
  const combinedLogFile = path.join(logDir, `combined-${dateStr}.log`);

  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  const logLine = `[${timestamp}] [${level.toUpperCase()}] [renderer/${source}] ${message}${dataStr}\n`;

  // 写入渲染进程日志文件
  fs.appendFileSync(logFile, logLine);

  // 同时写入合并日志文件
  fs.appendFileSync(combinedLogFile, logLine);

  // 也在主进程控制台输出
  const consoleFn = level === 'error' ? console.error : 
                    level === 'warn' ? console.warn : 
                    console.log;
  consoleFn(`[renderer/${source}] ${message}`, data || '');
}

/**
 * 读取日志文件列表
 */
export function listLogFiles(): string[] {
  const logDir = getLogDirectory();
  if (!fs.existsSync(logDir)) {
    return [];
  }
  return fs.readdirSync(logDir)
    .filter(f => f.endsWith('.log'))
    .map(f => path.join(logDir, f));
}

/**
 * 读取指定日志文件内容
 */
export function readLogFile(filename: string): string {
  const logDir = getLogDirectory();
  const logPath = path.join(logDir, filename);
  
  if (!fs.existsSync(logPath)) {
    throw new Error(`Log file not found: ${filename}`);
  }
  
  return fs.readFileSync(logPath, 'utf-8');
}

/**
 * 读取最近的日志内容
 * @param source 日志来源 (main/renderer/combined)
 * @param lines 读取的行数
 */
export function readRecentLogs(source: 'main' | 'renderer' | 'combined', lines: number = 100): string {
  const logDir = getLogDirectory();
  const dateStr = getDateString();
  const logFile = path.join(logDir, `${source}-${dateStr}.log`);

  if (!fs.existsSync(logFile)) {
    return `No log file found for ${source} on ${dateStr}`;
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const allLines = content.split('\n');
  const recentLines = allLines.slice(-lines);
  return recentLines.join('\n');
}

/**
 * 创建主进程 Logger 实例
 */
export function createLogger(source: string): MainLogger {
  return new MainLogger(source);
}

// 默认导出初始化后的 log 实例
export default log;
