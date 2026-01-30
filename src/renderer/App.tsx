import React from 'react';
import { ConversationList } from './components/Sidebar/ConversationList';
import { ChatWindow } from './components/Chat/ChatWindow';
import { useStore } from './store/useStore';
import './styles/App.css';

export default function App() {
  const { currentConversationId } = useStore();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <ConversationList />
      </aside>
      <main className="main-content">
        {currentConversationId ? (
          <ChatWindow conversationId={currentConversationId} />
        ) : (
          <div className="empty-state">
            <div className="empty-state-content">
              <h2>欢迎使用 ACP Client</h2>
              <p>选择一个会话或创建新会话开始对话</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
