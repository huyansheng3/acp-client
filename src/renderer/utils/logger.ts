/**
 * 渲染进程 Logger
 * 同时输出到 console 和通过 IPC 发送到主进程写入文件
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 渲染进程 Logger 类
 */
class RendererLogger {
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const timestamp = formatTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [renderer/${this.source}]`;

    // 输出到 console
    const consoleFn = level === 'error' ? console.error :
                      level === 'warn' ? console.warn :
                      level === 'debug' ? console.debug :
                      console.log;

    if (data !== undefined) {
      consoleFn(prefix, message, data);
    } else {
      consoleFn(prefix, message);
    }

    // 通过 IPC 发送到主进程写入文件
    try {
      if (window.electronAPI?.writeLog) {
        window.electronAPI.writeLog(level, this.source, message, data);
      }
    } catch (error) {
      // 忽略 IPC 错误，避免日志系统自身产生错误循环
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
}

/**
 * 创建渲染进程 Logger 实例
 */
export function createLogger(source: string): RendererLogger {
  return new RendererLogger(source);
}

// 导出默认 Logger
export default {
  createLogger,
};
