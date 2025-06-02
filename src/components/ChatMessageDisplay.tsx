
"use client";

import type React from 'react';
import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, type Message } from './ChatMessage';
import { Skeleton } from '@/components/ui/skeleton';

interface ChatMessageDisplayProps {
  messages: Message[];
  isLoadingAiResponse: boolean;
}

export const ChatMessageDisplay: React.FC<ChatMessageDisplayProps> = ({ messages, isLoadingAiResponse }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoadingAiResponse]);

  return (
    <ScrollArea className="h-full flex-grow" ref={scrollAreaRef}>
      <div className="p-4 space-y-2">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoadingAiResponse && (
          <div className="flex items-start gap-3 my-3 justify-start">
            <Skeleton className="h-8 w-8 rounded-full border" />
            <div className="max-w-[70%] rounded-lg px-4 py-3 shadow bg-card">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
