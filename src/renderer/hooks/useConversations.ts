import { useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';

/**
 * 会话管理 Hook
 */
export function useConversations() {
  const {
    conversations,
    currentConversationId,
    setConversations,
    addConversation,
    setCurrentConversation,
    deleteConversation: deleteConv,
    updateConversation: updateConv,
  } = useStore();

  /**
   * 加载会话列表
   */
  const loadConversations = useCallback(async () => {
    try {
      const convs = await window.electronAPI.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [setConversations]);

  /**
   * 创建新会话
   */
  const createConversation = useCallback(
    async (title: string = '新对话') => {
      try {
        const conv = await window.electronAPI.createConversation(title);
        addConversation(conv);
        setCurrentConversation(conv.id);
        return conv;
      } catch (error) {
        console.error('Failed to create conversation:', error);
        throw error;
      }
    },
    [addConversation, setCurrentConversation]
  );

  /**
   * 删除会话
   */
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.deleteConversation(id);
        deleteConv(id);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        throw error;
      }
    },
    [deleteConv]
  );

  /**
   * 更新会话
   */
  const updateConversation = useCallback(
    async (id: string, updates: { title?: string; status?: 'active' | 'archived' }) => {
      try {
        await window.electronAPI.updateConversation(id, updates);
        updateConv(id, updates);
      } catch (error) {
        console.error('Failed to update conversation:', error);
        throw error;
      }
    },
    [updateConv]
  );

  /**
   * 初始化：加载会话列表
   */
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    currentConversationId,
    createConversation,
    deleteConversation,
    updateConversation,
    setCurrentConversation,
    refreshConversations: loadConversations,
  };
}
