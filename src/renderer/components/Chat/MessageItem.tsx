import React from 'react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { Message } from '../../../types/conversation';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  console.log('[MessageItem] Rendering:', {
    id: message.id,
    role: message.role,
    contentLength: message.content?.length,
  });

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`message-item ${message.role}`}>
      <div className="message-avatar">{isUser ? '👤' : '🤖'}</div>
      <div className="message-content">
        <div className="message-text">
          {isUser ? (
            message.content
          ) : (
            <Streamdown plugins={{ code }}>{message.content}</Streamdown>
          )}
        </div>
        <div className="message-metadata">
          <span className="message-time">{formatTime(message.createdAt)}</span>
          {message.metadata?.model && (
            <span className="message-model">{message.metadata.model}</span>
          )}
          {message.metadata?.tokens && (
            <span className="message-tokens">
              {message.metadata.tokens} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
