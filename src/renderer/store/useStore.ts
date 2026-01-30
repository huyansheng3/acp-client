import { create } from 'zustand/react';
import { Conversation, Message } from '../../types/conversation';
import { createLogger } from '../utils/logger';

const logger = createLogger('useStore');

/**
 * 应用全局状态
 */
interface AppState {
  // 会话相关
  conversations: Conversation[];
  currentConversationId: string | null;
  
  // 消息相关
  messages: Record<string, Message[]>; // conversationId -> messages
  streamingMessage: string; // 当前正在流式接收的消息
  isStreaming: boolean;
  streamingConversationId: string | null;
  streamingMessageId: string | null;
  
  // Actions - 会话管理
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setCurrentConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  
  // Actions - 消息管理
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamingChunk: (chunk: string) => void;
  startStreaming: (conversationId: string, messageId: string) => void;
  finishStreaming: (conversationId: string, message: Message) => void;
  clearStreamingMessage: () => void;
}

/**
 * Zustand Store
 */
export const useStore = create<AppState>((set, get) => ({
  // 初始状态
  conversations: [],
  currentConversationId: null,
  messages: {},
  streamingMessage: '',
  isStreaming: false,
  streamingConversationId: null,
  streamingMessageId: null,
  
  // 会话管理 Actions
  setConversations: (conversations) => set({ conversations }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations],
  })),
  
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  
  deleteConversation: (id) => set((state) => {
    const newMessages = { ...state.messages };
    delete newMessages[id];
    
    return {
      conversations: state.conversations.filter((c) => c.id !== id),
      messages: newMessages,
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
    };
  }),
  
  updateConversation: (id, updates) => set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
  })),
  
  // 消息管理 Actions
  setMessages: (conversationId, messages) => set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: messages,
    },
  })),
  
  addMessage: (message) => set((state) => {
    const conversationId = message.conversationId;
    const existingMessages = state.messages[conversationId] || [];
    
    // 检查是否已存在（避免重复）
    const exists = existingMessages.some((m) => m.id === message.id);
    if (exists) {
      logger.debug('addMessage: Message already exists, skipping', { id: message.id });
      return state;
    }
    
    logger.debug('addMessage', {
      conversationId,
      messageId: message.id,
      role: message.role,
      beforeCount: existingMessages.length,
    });
    
    return {
      messages: {
        ...state.messages,
        [conversationId]: [...existingMessages, message],
      },
    };
  }),
  
  appendStreamingChunk: (chunk) => set((state) => {
    logger.debug('appendStreamingChunk', { chunkPreview: chunk.substring(0, 50) });
    return {
      streamingMessage: state.streamingMessage + chunk,
    };
  }),
  
  startStreaming: (conversationId, messageId) => {
    logger.debug('startStreaming', { conversationId, messageId });
    return set({
      isStreaming: true,
      streamingConversationId: conversationId,
      streamingMessageId: messageId,
      streamingMessage: '',
    });
  },
  
  finishStreaming: (conversationId, message) => set((state) => {
    const existingMessages = state.messages[conversationId] || [];
    
    logger.debug('finishStreaming', {
      conversationId,
      messageId: message.id,
      contentLength: message.content.length,
      beforeCount: existingMessages.length,
    });
    
    return {
      isStreaming: false,
      streamingConversationId: null,
      streamingMessageId: null,
      streamingMessage: '',
      messages: {
        ...state.messages,
        [conversationId]: [...existingMessages, message],
      },
    };
  }),
  
  clearStreamingMessage: () => {
    logger.debug('clearStreamingMessage');
    return set({
      streamingMessage: '',
      isStreaming: false,
      streamingConversationId: null,
      streamingMessageId: null,
    });
  },
}));
