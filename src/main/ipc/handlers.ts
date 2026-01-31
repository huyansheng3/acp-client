import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPCChannel } from '../../types/channels';
import { SessionManager } from '../managers/SessionManager';
import { DatabaseManager } from '../managers/DatabaseManager';
import { ConfigManager } from '../managers/ConfigManager';
import { Conversation, Message } from '../../types/conversation';
import { ACPPermissionResponse } from '../acp';
import {
  writeRendererLog,
  listLogFiles,
  readRecentLogs,
  getLogDirectory,
  createLogger,
} from '../utils/logger';

// 创建 IPC handlers 的 logger
const logger = createLogger('handlers');

/**
 * 设置 IPC 通信处理器
 */
export function setupIPCHandlers(
  mainWindow: BrowserWindow,
  sessionManager: SessionManager,
  dbManager: DatabaseManager,
  configManager: ConfigManager
) {
  // ==================== 会话管理 ====================

  /**
   * 创建会话
   */
  ipcMain.handle(
    IPCChannel.CONVERSATION_CREATE,
    async (_event, title: string): Promise<Conversation> => {
      if (!title || typeof title !== 'string') {
        throw new Error('Invalid title');
      }

      const id = uuidv4();
      const now = Date.now();

      const conversation: Conversation = {
        id,
        title: title.trim(),
        createdAt: now,
        updatedAt: now,
        status: 'active',
      };

      try {
        await dbManager.createConversation(conversation);
      } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
      }

      // 创建 Claude 会话（延迟到发送第一条消息时）
      // sessionManager.createSession(id);

      return conversation;
    }
  );

  /**
   * 获取会话列表
   */
  ipcMain.handle(
    IPCChannel.CONVERSATION_LIST,
    async (): Promise<Conversation[]> => {
      try {
        const conversations = await dbManager.getConversations();
        return conversations || [];
      } catch (error) {
        console.error('Error getting conversations:', error);
        throw error;
      }
    }
  );

  /**
   * 更新会话
   */
  ipcMain.handle(
    IPCChannel.CONVERSATION_UPDATE,
    async (_event, id: string, updates: Partial<Conversation>): Promise<void> => {
      if (!id || !updates || typeof updates !== 'object') {
        throw new Error('Invalid id or updates');
      }

      try {
        await dbManager.updateConversation(id, {
          ...updates,
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.error('Error updating conversation:', error);
        throw error;
      }
    }
  );

  /**
   * 删除会话
   */
  ipcMain.handle(
    IPCChannel.CONVERSATION_DELETE,
    async (_event, id: string): Promise<void> => {
      if (!id) {
        throw new Error('Invalid id');
      }

      try {
        // 销毁 Claude 会话
        sessionManager.destroySession(id);

        // 删除数据库记录
        await dbManager.deleteConversation(id);
      } catch (error) {
        console.error('Error deleting conversation:', error);
        throw error;
      }
    }
  );

  // ==================== 消息处理 ====================

  /**
   * 发送消息
   */
  ipcMain.handle(
    IPCChannel.MESSAGE_SEND,
    async (
      _event,
      conversationId: string,
      content: string
    ): Promise<{ userMessage: Message; assistantMessage: Message }> => {
      logger.info('MESSAGE_SEND START', { conversationId, content });

      const messageId = uuidv4();
      const userMessage: Message = {
        id: messageId,
        conversationId,
        role: 'user',
        content,
        createdAt: Date.now(),
      };

      logger.debug('Saving userMessage to DB', userMessage);
      // 保存用户消息
      await dbManager.createMessage(userMessage);

      // 更新会话时间
      logger.debug('Updating conversation timestamp');
      await dbManager.updateConversation(conversationId, {
        updatedAt: Date.now(),
      });

      // 获取或创建 ACP 会话
      logger.debug('Getting or creating ACP session', { conversationId });
      const session = await sessionManager.getOrCreateSession(conversationId);

      // 创建 assistant 消息
      const assistantMessageId = uuidv4();
      let fullResponse = '';
      let lastSendTime = Date.now();
      const THROTTLE_MS = 100; // 节流：每 100ms 最多发送一次

      try {
        // 检查 session 是否有效
        if (!session) {
          logger.error('Session not found or invalid');
          throw new Error('Session not found or invalid');
        }

        logger.info('Calling session.prompt (ACP)');
        // 使用 ACP session 的 prompt 方法
        const result = await session.prompt(content, (update) => {
          // 实际数据结构: { sessionId, update: { sessionUpdate, content, ... } }
          // 需要解包 update 字段
          const innerUpdate = (update as any).update || update;
          const sessionUpdate = innerUpdate.sessionUpdate;
          const contentData = innerUpdate.content;

          // 处理 agent_message_chunk 类型的更新
          if (sessionUpdate === 'agent_message_chunk') {
            const chunk = contentData?.text || '';
            if (chunk.length > 0) {
              fullResponse += chunk;
              
              logger.debug('Sending MESSAGE_STREAM chunk', { 
                chunkLength: chunk.length,
                totalLength: fullResponse.length 
              });
              mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
                conversationId,
                messageId: assistantMessageId,
                chunk,
                done: false,
              });
            }
          } else if (sessionUpdate === 'tool_call') {
            // 转发工具调用事件
            mainWindow.webContents.send(IPCChannel.ACP_TOOL_CALL, innerUpdate);
          } else if (sessionUpdate === 'tool_call_update') {
            // 转发工具调用更新事件
            mainWindow.webContents.send(IPCChannel.ACP_TOOL_CALL_UPDATE, innerUpdate);
          }
        });

        logger.info('session.prompt completed', { responseLength: fullResponse.length, stopReason: result?.stopReason });

        // 保存完整响应
        const assistantMessage: Message = {
          id: assistantMessageId,
          conversationId,
          role: 'assistant',
          content: fullResponse || 'No response received',
          createdAt: Date.now(),
        };

        logger.debug('Saving assistantMessage to DB', { id: assistantMessage.id, contentLength: assistantMessage.content.length });
        await dbManager.createMessage(assistantMessage);

        // 发送完成信号
        logger.info('Sending MESSAGE_STREAM DONE signal');
        mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
          conversationId,
          messageId: assistantMessageId,
          chunk: '',
          done: true,
        });

        logger.info('MESSAGE_SEND SUCCESS');
        return { userMessage, assistantMessage };
      } catch (error) {
        logger.error('Error sending message to Claude', error);

        // 发送错误消息
        const errorMessage: Message = {
          id: assistantMessageId,
          conversationId,
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          createdAt: Date.now(),
        };

        logger.error('Saving errorMessage to DB', errorMessage);
        await dbManager.createMessage(errorMessage);

        logger.info('Sending MESSAGE_STREAM DONE (error)');
        mainWindow.webContents.send(IPCChannel.MESSAGE_STREAM, {
          conversationId,
          messageId: assistantMessageId,
          chunk: '',
          done: true,
        });

        return { userMessage, assistantMessage: errorMessage };
      }
    }
  );

  /**
   * 获取消息列表
   */
  ipcMain.handle(
    IPCChannel.MESSAGE_LIST,
    async (_event, conversationId: string): Promise<Message[]> => {
      if (!conversationId) {
        throw new Error('Invalid conversationId');
      }

      try {
        const messages = await dbManager.getMessages(conversationId);
        return messages || [];
      } catch (error) {
        console.error('Error getting messages:', error);
        throw error;
      }
    }
  );

  // ==================== ACP 进程管理 ====================

  /**
   * 取消当前请求 (ACP)
   */
  ipcMain.handle(
    IPCChannel.ACP_CANCEL,
    async (_event, conversationId: string): Promise<void> => {
      if (!conversationId) {
        throw new Error('Invalid conversationId');
      }

      const session = sessionManager.getSession(conversationId);
      if (session) {
        try {
          await session.cancel();
          logger.info('Cancelled session', { conversationId });
        } catch (error) {
          logger.error('Error cancelling session', error);
          throw error;
        }
      }
    }
  );

  /**
   * 权限响应 (ACP)
   */
  ipcMain.handle(
    IPCChannel.ACP_PERMISSION_RESPONSE,
    async (_event, response: ACPPermissionResponse): Promise<void> => {
      try {
        sessionManager.respondToPermission(response);
        logger.info('Permission response sent', { 
          toolCallId: response.toolCallId, 
          granted: response.granted 
        });
      } catch (error) {
        logger.error('Error responding to permission', error);
        throw error;
      }
    }
  );

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  ipcMain.handle(IPCChannel.CONFIG_GET, async () => {
    try {
      const settings = configManager.readSettings();
      const apiKey = configManager.getApiKey();
      const model = configManager.getModel();

      return {
        settings,
        apiKey: apiKey ? '***已配置***' : undefined,
        model,
      };
    } catch (error) {
      console.error('Error in CONFIG_GET:', error);
      throw error;
    }
  });

  // ==================== 日志管理 ====================

  /**
   * 渲染进程日志写入
   */
  ipcMain.on(
    IPCChannel.LOG_WRITE,
    (_event, data: { level: string; source: string; message: string; data?: any }) => {
      const { level, source, message, data: logData } = data;
      writeRendererLog(level as any, source, message, logData);
    }
  );

  /**
   * 获取日志目录
   */
  ipcMain.handle(IPCChannel.LOG_GET_DIR, async () => {
    return getLogDirectory();
  });

  /**
   * 获取日志文件列表
   */
  ipcMain.handle(IPCChannel.LOG_LIST, async () => {
    return listLogFiles();
  });

  /**
   * 读取日志文件
   */
  ipcMain.handle(
    IPCChannel.LOG_READ,
    async (_event, source: 'main' | 'renderer' | 'combined', lines?: number) => {
      return readRecentLogs(source, lines || 100);
    }
  );
}
