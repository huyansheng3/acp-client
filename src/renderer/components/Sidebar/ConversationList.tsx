import React, { useState } from 'react';
import { useConversations } from '../../hooks/useConversations';
import { ConversationItem } from './ConversationItem';
import './ConversationList.css';

export function ConversationList() {
  const {
    conversations,
    currentConversationId,
    createConversation,
    setCurrentConversation,
  } = useConversations();

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateConversation = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      await createConversation('新对话');
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>对话列表</h2>
        <button
          className="create-conversation-button"
          onClick={handleCreateConversation}
          disabled={isCreating}
        >
          {isCreating ? '创建中...' : '+ 新对话'}
        </button>
      </div>

      <div className="conversation-items">
        {conversations.length === 0 ? (
          <div className="empty-conversations">
            <p>暂无对话</p>
            <p className="hint">点击上方按钮创建新对话</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === currentConversationId}
              onClick={() => setCurrentConversation(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
