/**
 * 会话数据类型
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  claudeSessionId?: string;
}

/**
 * 消息数据类型
 */
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  metadata?: {
    tokens?: number;
    model?: string;
    reasoning?: string;
  };
}

/**
 * 工具调用记录
 */
export interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  input: any;
  output?: any;
  status: 'pending' | 'success' | 'error';
  createdAt: number;
}
