
"use client";

import type React from 'react';
import { useState, useRef, type ForwardedRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  inputRef?: ForwardedRef<HTMLTextAreaElement>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, inputRef }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2 p-1 border-t">
      <Textarea
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="코드에 대해 질문하세요... (Shift+Enter로 줄바꿈)"
        className="flex-grow resize-none rounded-md shadow-inner text-sm min-h-[60px] max-h-[150px]"
        rows={2}
        disabled={isLoading}
      />
      <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()} className="h-auto p-3 aspect-square self-stretch">
        <Send className="h-5 w-5" />
        <span className="sr-only">메시지 보내기</span>
      </Button>
    </form>
  );
};
