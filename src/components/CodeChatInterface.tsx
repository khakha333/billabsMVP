
"use client";

import type React from 'react';
import { useState, type ForwardedRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatInput } from './ChatInput';
import { ChatMessageDisplay } from './ChatMessageDisplay';
import type { Message } from './ChatMessage';
import { chatWithCodeAction } from '@/lib/actions';
import { MessageSquareDashed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CodeChatInterfaceProps {
  currentCode: string | null;
  chatInputRef?: ForwardedRef<HTMLTextAreaElement>;
  className?: string;
}

export const CodeChatInterface: React.FC<CodeChatInterfaceProps> = ({ currentCode, chatInputRef, className }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async (question: string) => {
    if (!currentCode) {
      toast({
        title: "오류",
        description: "질문할 코드가 없습니다. 먼저 코드를 분석해주세요.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      sender: 'user',
      text: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const aiResponse = await chatWithCodeAction({ code: currentCode, question });
      const aiMessage: Message = {
        id: Date.now().toString() + '_ai',
        sender: 'ai',
        text: aiResponse.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      const aiErrorMessage: Message = {
        id: Date.now().toString() + '_ai_error',
        sender: 'ai',
        text: `오류: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiErrorMessage]);
      toast({
        title: "채팅 오류",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentCode) {
    return null; // Don't render if no code is active
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageSquareDashed className="h-6 w-6 text-primary" />
          AI 코드 채팅
        </CardTitle>
        <CardDescription>
          현재 코드에 대해 AI에게 질문하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow p-0 flex flex-col overflow-hidden">
        <ChatMessageDisplay messages={messages} isLoadingAiResponse={isLoading} />
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} inputRef={chatInputRef} />
      </CardContent>
    </Card>
  );
};
