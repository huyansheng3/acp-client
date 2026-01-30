import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannel } from '../types/channels';
import { Conversation, Message } from '../types/conversation';

/**
 * Electron API 暴露给渲染进程
 */
const electronAPI = {
  // 会话管理
  createConversation: (title: string): Promise<Conversation> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_CREATE, title),

  listConversations: (): Promise<Conversation[]> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_LIST),

  deleteConversation: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_DELETE, id),

  updateConversation: (id: string, updates: Partial<Conversation>): Promise<void> =>
    ipcRenderer.invoke(IPCChannel.CONVERSATION_UPDATE, id, updates),

  // 消息
  sendMessage: (
    conversationId: string,
    content: string
  ): Promise<{ userMessage: Message; assistantMessage: Message }> =>
    ipcRenderer.invoke(IPCChannel.MESSAGE_SEND, conversationId, content),

  listMessages: (conversationId: string): Promise<Message[]> =>
    ipcRenderer.invoke(IPCChannel.MESSAGE_LIST, conversationId),

  // 监听流式消息
  onMessageStream: (
    callback: (data: {
      conversationId: string;
      messageId: string;
      chunk: string;
      done: boolean;
    }) => void
  ) => {
    ipcRenderer.on(IPCChannel.MESSAGE_STREAM, (_event, data) => callback(data));
  },

  offMessageStream: () => {
    ipcRenderer.removeAllListeners(IPCChannel.MESSAGE_STREAM);
  },

  // Claude 进程管理
  injectMessage: (conversationId: string, message: string): Promise<void> =>
    ipcRenderer.invoke(IPCChannel.CLAUDE_INJECT, conversationId, message),

  stopClaude: (conversationId: string): Promise<void> =>
    ipcRenderer.invoke(IPCChannel.CLAUDE_STOP, conversationId),

  // 配置
  getConfig: (): Promise<any> => ipcRenderer.invoke(IPCChannel.CONFIG_GET),

  // 日志
  writeLog: (level: string, source: string, message: string, data?: any): void => {
    ipcRenderer.send(IPCChannel.LOG_WRITE, { level, source, message, data });
  },

  getLogDir: (): Promise<string> => ipcRenderer.invoke(IPCChannel.LOG_GET_DIR),

  listLogs: (): Promise<string[]> => ipcRenderer.invoke(IPCChannel.LOG_LIST),

  readLog: (filename: string, lines?: number): Promise<string> =>
    ipcRenderer.invoke(IPCChannel.LOG_READ, filename, lines),
};

// 安全地暴露 API
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  console.error('Failed to expose electronAPI:', error);
}

export type ElectronAPI = typeof electronAPI;
