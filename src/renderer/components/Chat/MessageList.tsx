import React from 'react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { Message } from '../../../types/conversation';
import { MessageItem } from './MessageItem';
import { createLogger } from '../../utils/logger';
import './MessageList.css';

const logger = createLogger('MessageList');

interface MessageListProps {
  messages: Message[];
  streamingMessage: string;
  isStreaming: boolean;
}

function MessageList({
  messages,
  streamingMessage,
  isStreaming,
}: MessageListProps) {
  logger.debug('Rendering', {
    messagesCount: messages.length,
    streamingMessageLength: streamingMessage.length,
    isStreaming,
  });

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {/* 流式响应中：显示正在生成的消息 */}
      {isStreaming && (
        <div className="message-item assistant streaming">
          <div className="message-avatar">🤖</div>
          <div className="message-content">
            {streamingMessage ? (
              <div className="message-text">
                <Streamdown plugins={{ code }} isAnimating>
                  {streamingMessage}
                </Streamdown>
              </div>
            ) : (
              <div className="message-text thinking">正在思考...</div>
            )}
            <div className="streaming-indicator">
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </div>
          </div>
        </div>
      )}

      {messages.length === 0 && !isStreaming && (
        <div className="empty-messages">
          <p>暂无消息</p>
          <p className="hint">在下方输入框发送消息开始对话</p>
        </div>
      )}
    </div>
  );
}

export default MessageList;

export { MessageList };
