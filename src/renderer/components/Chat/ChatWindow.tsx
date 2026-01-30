import React, { useRef, useEffect } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import './ChatWindow.css';

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { messages, streamingMessage, isStreaming, sendMessage } =
    useMessages(conversationId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  return (
    <div className="chat-window">
      <div className="chat-messages">
        <MessageList
          messages={messages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <InputBox onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
