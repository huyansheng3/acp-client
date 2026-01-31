import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ACPSession, ACPSessionUpdateCallback } from './ACPSession';
import type {
  ACPClientConfig,
  ACPSessionUpdate,
  ACPPromptResult,
  ACPContent,
  ACPPermissionRequest,
  ACPPermissionResponse,
  ACPConnectionState,
} from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ACPClient');

/**
 * JSON-RPC 请求
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 响应
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 通知
 */
interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * ACP Client
 * 管理与 Claude Code Agent 子进程的 ACP 协议通信
 */
export class ACPClient extends EventEmitter {
  private config: Required<ACPClientConfig>;
  private agentProcess: ChildProcess | null = null;
  private connectionState: ACPConnectionState = 'disconnected';
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  private sessions = new Map<string, ACPSession>();
  private inputBuffer = '';

  // 权限请求处理器
  private permissionHandler:
    | ((request: ACPPermissionRequest) => Promise<ACPPermissionResponse>)
    | null = null;

  constructor(config: ACPClientConfig = {}) {
    super();
    this.config = {
      // 使用 @zed-industries/claude-code-acp 适配器
      // 需要先安装: npm install -g @zed-industries/claude-code-acp
      agentCommand: config.agentCommand || ['claude-code-acp'],
      workingDir: config.workingDir || process.cwd(),
      clientInfo: config.clientInfo || {
        name: 'acp-client',
        version: '1.0.0',
      },
      env: config.env || {},
    };
  }

  /**
   * 启动 Agent 子进程并建立 ACP 连接
   */
  async connect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      throw new Error(`Cannot connect: state is ${this.connectionState}`);
    }

    this.connectionState = 'connecting';
    const [cmd, ...args] = this.config.agentCommand;

    logger.info('Starting agent process', { cmd, args });

    try {
      // 1. 启动子进程，合并环境变量
      const env = { ...process.env, ...this.config.env };
      
      logger.debug('Agent environment', {
        hasAnthropicApiKey: !!env.ANTHROPIC_API_KEY,
        hasAnthropicAuthToken: !!env.ANTHROPIC_AUTH_TOKEN,
      });

      this.agentProcess = spawn(cmd, args, {
        cwd: this.config.workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      // 2. 设置事件处理
      this.setupProcessHandlers();

      // 3. 执行初始化握手
      await this.initialize();

      this.connectionState = 'connected';
      this.emit('connected');
      logger.info('Connected to agent');
    } catch (error) {
      this.connectionState = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 设置进程事件处理
   */
  private setupProcessHandlers(): void {
    if (!this.agentProcess) return;

    // 处理 stdout（JSON-RPC 消息）
    this.agentProcess.stdout?.on('data', (data: Buffer) => {
      this.handleStdoutData(data.toString('utf-8'));
    });

    // 处理 stderr（日志）
    this.agentProcess.stderr?.on('data', (data: Buffer) => {
      logger.debug('Agent stderr', { output: data.toString('utf-8').trim() });
    });

    // 处理进程退出
    this.agentProcess.on('exit', (code, signal) => {
      logger.info('Agent process exited', { code, signal });
      this.connectionState = 'disconnected';
      this.agentProcess = null;
      this.emit('disconnected', { code, signal });
    });

    // 处理进程错误
    this.agentProcess.on('error', (error) => {
      logger.error('Agent process error', { error: error.message });
      this.connectionState = 'error';
      this.emit('error', error);
    });
  }

  /**
   * 处理 stdout 数据
   * 消息以换行符分隔
   */
  private handleStdoutData(data: string): void {
    this.inputBuffer += data;

    // 按换行符分割消息
    const lines = this.inputBuffer.split('\n');
    this.inputBuffer = lines.pop() || ''; // 保留最后一个不完整的行

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse message', { line, error });
        }
      }
    }
  }

  /**
   * 处理 JSON-RPC 消息
   */
  private handleMessage(
    message: JsonRpcResponse | JsonRpcNotification
  ): void {
    // 检查是响应还是通知
    if ('id' in message && message.id !== undefined) {
      // 这是一个响应
      this.handleResponse(message as JsonRpcResponse);
    } else if ('method' in message) {
      // 这是一个通知或请求
      this.handleNotificationOrRequest(message as JsonRpcNotification);
    }
  }

  /**
   * 处理响应
   */
  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      logger.warn('Received response for unknown request', { id: response.id });
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(
        new Error(`${response.error.message} (code: ${response.error.code})`)
      );
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * 处理通知或来自 Agent 的请求
   */
  private handleNotificationOrRequest(
    message: JsonRpcNotification
  ): void {
    const { method, params } = message;

    switch (method) {
      case 'session/update':
        this.handleSessionUpdate(params as unknown as ACPSessionUpdate);
        break;
      case 'session/request_permission':
        this.handlePermissionRequest(
          params as unknown as ACPPermissionRequest
        );
        break;
      default:
        logger.debug('Unhandled notification', { method });
    }
  }

  /**
   * 处理会话更新通知
   */
  private handleSessionUpdate(update: ACPSessionUpdate): void {
    // 打印完整的 update 对象以调试
    logger.info('Session update received (raw)', {
      sessionId: update.sessionId,
      rawUpdate: JSON.stringify(update).substring(0, 500),
    });
    this.emit('session/update', update);
  }

  /**
   * 处理权限请求
   */
  private async handlePermissionRequest(
    request: ACPPermissionRequest
  ): Promise<void> {
    logger.info('Permission request', {
      sessionId: request.sessionId,
      toolCallId: request.toolCallId,
      title: request.title,
    });

    if (this.permissionHandler) {
      try {
        const response = await this.permissionHandler(request);
        // 发送权限响应
        // 注意：这可能需要根据实际 ACP 协议调整
        this.emit('permission/response', response);
      } catch (error) {
        logger.error('Permission handler error', { error });
      }
    } else {
      // 默认拒绝
      logger.warn('No permission handler, denying request');
    }
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private async sendRequest<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    if (!this.agentProcess?.stdin) {
      throw new Error('Not connected');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      const message = JSON.stringify(request) + '\n';
      this.agentProcess!.stdin!.write(message, 'utf-8', (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      logger.debug('Sent request', { method, id });
    });
  }

  /**
   * 发送 JSON-RPC 通知
   */
  private sendNotification(
    method: string,
    params?: Record<string, unknown>
  ): void {
    if (!this.agentProcess?.stdin) {
      throw new Error('Not connected');
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const message = JSON.stringify(notification) + '\n';
    this.agentProcess.stdin.write(message, 'utf-8');
    logger.debug('Sent notification', { method });
  }

  /**
   * 执行初始化握手
   */
  private async initialize(): Promise<void> {
    logger.info('Initializing connection');

    await this.sendRequest('initialize', {
      protocolVersion: 1,
      clientInfo: this.config.clientInfo,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
      },
    });

    logger.info('Initialization complete');
  }

  /**
   * 创建新会话
   */
  async newSession(sessionId?: string): Promise<ACPSession> {
    if (this.connectionState !== 'connected') {
      throw new Error('Not connected');
    }

    // session/new 需要 cwd 和 mcpServers 参数
    // mcpServers 是一个数组，可以为空数组（不使用 MCP 服务器）
    const result = (await this.sendRequest<{ sessionId: string }>(
      'session/new',
      {
        sessionId,
        cwd: this.config.workingDir,
        mcpServers: [],  // 空数组表示不配置 MCP 服务器
      }
    ));

    const session = new ACPSession(result.sessionId);

    // 注入连接方法
    session.setConnection(
      (sid, prompt, onUpdate) => this.sendPrompt(sid, prompt, onUpdate),
      (sid) => this.sendCancel(sid)
    );

    this.sessions.set(result.sessionId, session);
    logger.info('Created session', { sessionId: result.sessionId });

    return session;
  }

  /**
   * 发送 prompt
   */
  private async sendPrompt(
    sessionId: string,
    prompt: ACPContent[],
    onUpdate: ACPSessionUpdateCallback
  ): Promise<ACPPromptResult> {
    // 注册临时更新监听器
    const updateHandler = (update: ACPSessionUpdate) => {
      if (update.sessionId === sessionId) {
        onUpdate(update);
      }
    };

    this.on('session/update', updateHandler);

    try {
      const result = await this.sendRequest<ACPPromptResult>('session/prompt', {
        sessionId,
        prompt,
      });
      return result;
    } finally {
      this.off('session/update', updateHandler);
    }
  }

  /**
   * 取消会话的当前 prompt
   */
  private async sendCancel(sessionId: string): Promise<void> {
    this.sendNotification('session/cancel', { sessionId });
  }

  /**
   * 设置权限请求处理器
   */
  setPermissionHandler(
    handler: (
      request: ACPPermissionRequest
    ) => Promise<ACPPermissionResponse>
  ): void {
    this.permissionHandler = handler;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): ACPSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ACPConnectionState {
    return this.connectionState;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting');

    // 销毁所有会话
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();

    // 清理待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Disconnected'));
      this.pendingRequests.delete(id);
    }

    // 终止子进程
    if (this.agentProcess) {
      this.agentProcess.kill();
      this.agentProcess = null;
    }

    this.connectionState = 'disconnected';
    this.emit('disconnected');
    logger.info('Disconnected');
  }
}
