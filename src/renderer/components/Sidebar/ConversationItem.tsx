import React, { useState } from 'react';
import { useConversations } from '../../hooks/useConversations';
import { Conversation } from '../../../types/conversation';
import './ConversationItem.css';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const { deleteConversation, updateConversation } = useConversations();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;

    const confirmed = window.confirm(`确定要删除对话"${conversation.title}"吗？`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteConversation(conversation.id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editTitle.trim() === '') {
      alert('标题不能为空');
      return;
    }

    try {
      await updateConversation(conversation.id, { title: editTitle.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update conversation:', error);
      alert('更新失败');
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(conversation.title);
    setIsEditing(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 一天内显示时间
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // 一周内显示星期
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    }

    // 超过一周显示日期
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="conversation-content">
        {isEditing ? (
          <div className="edit-mode" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
            />
            <div className="edit-actions">
              <button onClick={handleSaveEdit} className="save-btn">
                ✓
              </button>
              <button onClick={handleCancelEdit} className="cancel-btn">
                ✗
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="conversation-title">{conversation.title}</div>
            <div className="conversation-date">
              {formatDate(conversation.updatedAt)}
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="conversation-actions">
          <button
            className="edit-button"
            onClick={handleEdit}
            title="重命名"
          >
            ✏️
          </button>
          <button
            className="delete-button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="删除"
          >
            {isDeleting ? '...' : '🗑️'}
          </button>
        </div>
      )}
    </div>
  );
}
