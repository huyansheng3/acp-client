import { useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Message } from '../../types/conversation';
import { createLogger } from '../utils/logger';

const logger = createLogger('useMessages');

/**
 * 消息管理 Hook
 */
export function useMessages(conversationId: string | null) {
  const {
    messages,
    streamingMessage,
    isStreaming,
    streamingConversationId,
    streamingMessageId,
    setMessages,
    addMessage,
    startStreaming,
    finishStreaming,
    appendStreamingChunk,
    clearStreamingMessage,
  } = useStore();

  // 当前会话的消息
  const currentMessages = conversationId ? messages[conversationId] || [] : [];

  /**
   * 加载消息列表
   */
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const msgs = await window.electronAPI.listMessages(conversationId);
      setMessages(conversationId, msgs);
    } catch (error) {
      logger.error('Failed to load messages', error);
    }
  }, [conversationId, setMessages]);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) {
        logger.warn('sendMessage: conversationId is null');
        return;
      }

      logger.info('sendMessage START', {
        conversationId,
        content,
        currentMessagesCount: currentMessages.length,
      });

      try {
        // 添加用户消息（临时）
        const tempUserMessage: Message = {
          id: 'temp-user-' + Date.now(),
          conversationId,
          role: 'user',
          content,
          createdAt: Date.now(),
        };
        logger.debug('addMessage (temp)', tempUserMessage);
        addMessage(tempUserMessage);

        // 开始流式响应
        const streamingMsgId = 'temp-assistant-' + Date.now();
        logger.debug('startStreaming', {
          conversationId,
          messageId: streamingMsgId,
        });
        startStreaming(conversationId, streamingMsgId);

        // 发送消息到主进程
        logger.info('calling electronAPI.sendMessage');
        const { userMessage, assistantMessage } =
          await window.electronAPI.sendMessage(conversationId, content);

        logger.debug('electronAPI.sendMessage response', {
          userMessage,
          assistantMessage,
        });

        // 清除流式状态
        clearStreamingMessage();

        // 从数据库重新加载消息，确保状态一致
        // 这样可以避免闭包问题，同时包含 userMessage 和 assistantMessage
        logger.debug('Reloading messages from database');
        await loadMessages();

        logger.info('sendMessage DONE');
      } catch (error) {
        logger.error('sendMessage ERROR', error);
        clearStreamingMessage();

        // 添加错误消息
        const errorMessage: Message = {
          id: 'error-' + Date.now(),
          conversationId,
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          createdAt: Date.now(),
        };
        logger.debug('addMessage (error)', errorMessage);
        addMessage(errorMessage);
      }
    },
    [
      conversationId,
      addMessage,
      startStreaming,
      clearStreamingMessage,
      loadMessages,
    ]
  );

  /**
   * 监听流式消息
   */
  useEffect(() => {
    if (!conversationId) return;

    const handleMessageStream = (data: {
      conversationId: string;
      messageId: string;
      chunk: string;
      done: boolean;
    }) => {
      if (data.conversationId !== conversationId) {
        return;
      }

      if (data.done) {
        logger.info('Stream DONE');
        // 流式响应完成 - 不需要在这里处理，sendMessage 完成后会 loadMessages
      } else if (data.chunk) {
        // 追加流式数据
        logger.debug('appendStreamingChunk', { chunkLength: data.chunk.length });
        appendStreamingChunk(data.chunk);
      }
    };

    logger.debug('Setting up MESSAGE_STREAM listener', { conversationId });
    window.electronAPI.onMessageStream(handleMessageStream);

    return () => {
      logger.debug('Cleaning up MESSAGE_STREAM listener');
      window.electronAPI.offMessageStream();
    };
  }, [conversationId, appendStreamingChunk]);

  /**
   * 初始化：加载消息列表
   */
  useEffect(() => {
    logger.debug('Init effect', { conversationId });
    if (conversationId) {
      loadMessages();
    }
  }, [conversationId, loadMessages]);

  return {
    messages: currentMessages,
    streamingMessage: streamingConversationId === conversationId ? streamingMessage : '',
    isStreaming: streamingConversationId === conversationId && isStreaming,
    sendMessage,
    refreshMessages: loadMessages,
  };
}
