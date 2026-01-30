import React, { useState, useRef, useEffect } from 'react';
import './InputBox.css';

interface InputBoxProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function InputBox({ onSend, disabled = false }: InputBoxProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || disabled) {
      console.log('[InputBox] handleSend skipped:', { trimmedInput, disabled });
      return;
    }

    console.log('[InputBox] handleSend calling onSend:', trimmedInput);
    onSend(trimmedInput);
    setInput('');
    
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter 发送（不按 Shift）
    // Shift + Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // 自动调整高度
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  // 聚焦到输入框
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="input-box">
      <textarea
        ref={textareaRef}
        className="input-textarea"
        placeholder={disabled ? '正在生成回复...' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <button
        className="send-button"
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        title="发送 (Enter)"
      >
        {disabled ? '⏸️' : '📤'}
      </button>
    </div>
  );
}
