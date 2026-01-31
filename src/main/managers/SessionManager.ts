import { BrowserWindow } from 'electron';
import {
  ACPClient,
  ACPSession,
  ACPClientConfig,
  ACPPermissionRequest,
  ACPPermissionResponse,
  ACPSessionUpdate,
} from '../acp';
import { IPCChannel } from '../../types/channels';
import { createLogger } from '../utils/logger';

const logger = createLogger('SessionManager');

/**
 * 会话管理器配置
 */
export interface SessionManagerConfig {
  /** ACP Client 配置 */
  acpConfig?: ACPClientConfig;
}

/**
 * 会话管理器 - 管理 ACP 连接和会话
 *
 * 职责：
 * 1. 管理单个 ACPClient 实例（与 Agent 子进程的连接）
 * 2. 管理多个 ACPSession 实例（每个 conversation 一个）
 * 3. 处理权限请求转发到渲染进程
 */
export class SessionManager {
  private acpClient: ACPClient | null = null;
  private sessions: Map<string, ACPSession> = new Map();
  private config: SessionManagerConfig;
  private mainWindow: BrowserWindow | null = null;
  private pendingPermissionRequests: Map<
    string,
    {
      resolve: (response: ACPPermissionResponse) => void;
      reject: (error: Error) => void;
    }
  > = new Map();

  constructor(config: SessionManagerConfig = {}) {
    this.config = config;
  }

  /**
   * 设置主窗口引用（用于发送 IPC 消息）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 初始化并连接到 Agent
   */
  async connect(): Promise<void> {
    if (this.acpClient) {
      logger.warn('Already connected');
      return;
    }

    logger.info('Connecting to Agent...');

    this.acpClient = new ACPClient(this.config.acpConfig);

    // 设置事件监听
    this.setupEventListeners();

    // 连接到 Agent
    await this.acpClient.connect();

    logger.info('Connected to Agent');
  }

  /**
   * 设置 ACP 事件监听
   */
  private setupEventListeners(): void {
    if (!this.acpClient) return;

    // 监听会话更新
    this.acpClient.on('session/update', (update: ACPSessionUpdate) => {
      this.handleSessionUpdate(update);
    });

    // 监听连接断开
    this.acpClient.on('disconnected', ({ code, signal }) => {
      logger.warn('Agent disconnected', { code, signal });
      // 可以在这里实现自动重连逻辑
    });

    // 监听错误
    this.acpClient.on('error', (error: Error) => {
      logger.error('ACP error', { error: error.message });
    });

    // 设置权限处理器
    this.acpClient.setPermissionHandler(async (request) => {
      return this.handlePermissionRequest(request);
    });
  }

  /**
   * 处理会话更新
   */
  private handleSessionUpdate(update: ACPSessionUpdate): void {
    if (!this.mainWindow) return;

    // 实际数据结构: { sessionId, update: { sessionUpdate, content, ... } }
    // 需要解包 update 字段
    const innerUpdate = (update as any).update || update;
    const sessionUpdate = innerUpdate.sessionUpdate;
    const content = innerUpdate.content;

    logger.info('SessionManager handling update', {
      sessionUpdate,
      hasContent: !!content,
      contentText: content?.text?.substring(0, 50),
    });

    // 根据更新类型发送到不同的 IPC 通道
    switch (sessionUpdate) {
      case 'agent_message_chunk':
        // 发送流式消息更新
        const text = content?.text || '';
        if (text) {
          logger.debug('Sending agent_message_chunk to renderer', {
            textLength: text.length,
          });
          this.mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
            conversationId: update.sessionId,
            chunk: text,
            done: false,
          });
        }
        break;

      case 'agent_thought_chunk':
        // 思考内容，暂时不处理
        logger.debug('Agent thought chunk (ignored)', {
          textLength: content?.text?.length,
        });
        break;

      case 'tool_call':
        // 发送工具调用事件
        this.mainWindow.webContents.send(IPCChannel.ACP_TOOL_CALL, innerUpdate);
        break;

      case 'tool_call_update':
        // 发送工具调用更新事件
        this.mainWindow.webContents.send(
          IPCChannel.ACP_TOOL_CALL_UPDATE,
          innerUpdate
        );
        break;

      case 'available_commands_update':
        // 可用命令更新，暂时不处理
        logger.debug('Available commands update (ignored)');
        break;

      default:
        logger.debug('Unhandled session update type', {
          type: sessionUpdate,
        });
    }
  }

  /**
   * 处理权限请求
   */
  private async handlePermissionRequest(
    request: ACPPermissionRequest
  ): Promise<ACPPermissionResponse> {
    if (!this.mainWindow) {
      logger.warn('No main window, denying permission');
      return { toolCallId: request.toolCallId, granted: false };
    }

    return new Promise((resolve, reject) => {
      // 保存 pending 请求
      this.pendingPermissionRequests.set(request.toolCallId, {
        resolve,
        reject,
      });

      // 发送到渲染进程
      this.mainWindow!.webContents.send(
        IPCChannel.ACP_PERMISSION_REQUEST,
        request
      );

      // 设置超时
      setTimeout(() => {
        const pending = this.pendingPermissionRequests.get(request.toolCallId);
        if (pending) {
          this.pendingPermissionRequests.delete(request.toolCallId);
          pending.resolve({ toolCallId: request.toolCallId, granted: false });
        }
      }, 60000); // 60 秒超时
    });
  }

  /**
   * 响应权限请求（由 IPC handler 调用）
   */
  respondToPermission(response: ACPPermissionResponse): void {
    const pending = this.pendingPermissionRequests.get(response.toolCallId);
    if (pending) {
      this.pendingPermissionRequests.delete(response.toolCallId);
      pending.resolve(response);
    } else {
      logger.warn('No pending permission request', {
        toolCallId: response.toolCallId,
      });
    }
  }

  /**
   * 获取或创建会话
   */
  async getOrCreateSession(conversationId: string): Promise<ACPSession> {
    logger.debug('getOrCreateSession', { conversationId });

    // 检查是否已有会话
    let session = this.sessions.get(conversationId);
    if (session) {
      logger.debug('Reusing existing session');
      return session;
    }

    // 确保已连接
    if (!this.acpClient) {
      await this.connect();
    }

    // 创建新会话
    logger.debug('Creating new session');
    session = await this.acpClient!.newSession(conversationId);
    this.sessions.set(conversationId, session);

    return session;
  }

  /**
   * 获取会话
   */
  getSession(conversationId: string): ACPSession | undefined {
    return this.sessions.get(conversationId);
  }

  /**
   * 销毁会话
   */
  destroySession(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.destroy();
      this.sessions.delete(conversationId);
      logger.info('Destroyed session', { conversationId });
    }
  }

  /**
   * 销毁所有会话并断开连接
   */
  async destroyAll(): Promise<void> {
    logger.info('Destroying all sessions...');

    // 销毁所有会话
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();

    // 断开 ACP 连接
    if (this.acpClient) {
      await this.acpClient.disconnect();
      this.acpClient = null;
    }

    logger.info('All sessions destroyed');
  }

  /**
   * 获取当前活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取所有活跃会话 ID
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.acpClient?.getConnectionState() === 'connected';
  }
}
