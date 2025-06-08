
"use client";

import type React from 'react';
import { useState, type ForwardedRef, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatInput } from './ChatInput';
import { ChatMessageDisplay } from './ChatMessageDisplay';
import type { Message } from './ChatMessage';
import { chatWithCodeAction } from '@/lib/actions';
import { MessageSquareDashed, Paperclip, XCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';


interface CodeChatInterfaceProps {
  currentCode: string | null;
  chatInputRef?: ForwardedRef<HTMLTextAreaElement>;
  className?: string;
}

export const CodeChatInterface: React.FC<CodeChatInterfaceProps> = ({ currentCode, chatInputRef, className }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalContextText, setAdditionalContextText] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set workerSrc for pdfjs-dist. This should ideally point to a self-hosted worker in production.
    // Using a CDN for prototyping purposes.
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: '파일 형식 오류',
        description: 'PDF 파일만 업로드할 수 있습니다.',
        variant: 'destructive',
      });
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      return;
    }

    setIsLoading(true); // Use main loading indicator for file processing
    toast({ title: 'PDF 처리 중...', description: '파일에서 텍스트를 추출하고 있습니다.' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      setAdditionalContextText(fullText);
      setUploadedFileName(file.name);
      toast({ title: 'PDF 처리 완료', description: `"${file.name}" 파일의 내용이 컨텍스트로 추가되었습니다.` });
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast({
        title: 'PDF 처리 실패',
        description: 'PDF 파일에서 텍스트를 추출하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
      setAdditionalContextText(null);
      setUploadedFileName(null);
    } finally {
      setIsLoading(false);
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    }
  };

  const handleRemoveFile = () => {
    setAdditionalContextText(null);
    setUploadedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset the actual file input
    }
    toast({ title: '첨부 파일 제거됨', description: '추가 컨텍스트가 제거되었습니다.' });
  };

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
      const aiResponse = await chatWithCodeAction({ 
        code: currentCode, 
        question,
        additionalContext: additionalContextText ?? undefined // Pass undefined if null
      });
      const aiMessage: Message = {
        id: Date.now().toString() + '_ai',
        sender: 'ai',
        text: aiResponse.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error)_ {
      console.error("Chat error:", error);
      const errorMessageText = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      const aiErrorMessage: Message = {
        id: Date.now().toString() + '_ai_error',
        sender: 'ai',
        text: `오류: ${errorMessageText}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiErrorMessage]);
      toast({
        title: "채팅 오류",
        description: errorMessageText,
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
          현재 코드에 대해 AI에게 질문하세요. PDF 문서를 첨부하여 답변의 정확도를 높일 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow p-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          {uploadedFileName ? (
            <div className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium truncate" title={uploadedFileName}>{uploadedFileName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-6 w-6">
                <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                <span className="sr-only">첨부 파일 제거</span>
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full text-sm">
              <Paperclip className="mr-2 h-4 w-4" />
              API 문서(PDF) 첨부 (선택 사항)
            </Button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
        </div>
        <ChatMessageDisplay messages={messages} isLoadingAiResponse={isLoading} />
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} inputRef={chatInputRef} />
      </CardContent>
    </Card>
  );
};
