
"use client";

import type React from 'react';
import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, UploadCloud, FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CodeInputAreaProps {
  onAnalyze: (code: string) => void;
  isLoading: boolean;
}

export const CodeInputArea: React.FC<CodeInputAreaProps> = ({ onAnalyze, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAnalyze(inputValue);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setInputValue(text);
          toast({
            title: "파일 로드 성공",
            description: `"${file.name}" 파일의 내용이 성공적으로 로드되었습니다.`,
          });
        } else {
          toast({
            title: "파일 로드 실패",
            description: "파일 내용을 읽는 중 오류가 발생했습니다.",
            variant: "destructive",
          });
        }
      };
      reader.onerror = () => {
        toast({
          title: "파일 로드 오류",
          description: "파일을 읽는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      };
      reader.readAsText(file);
    }
    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UploadCloud className="h-6 w-6 text-primary" />
          코드 입력
        </CardTitle>
        <CardDescription>
          AI 기반 분석 및 설명을 받으려면 아래에 코드 스니펫을 붙여넣거나 파일을 업로드하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="여기에 코드를 붙여넣거나 파일을 업로드하세요..."
          className="h-full w-full resize-none font-mono text-sm p-3 rounded-md shadow-inner"
          aria-label="Code input area"
        />
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.swift,.kt,.kts,.html,.css,.json,.md,.txt,.*" 
          className="hidden"
        />
        <Button onClick={handleUploadButtonClick} variant="outline" className="w-full sm:w-auto" disabled={isLoading}>
          <FileUp className="mr-2 h-5 w-5" />
          파일에서 코드 불러오기
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !inputValue.trim()} className="w-full sm:w-auto flex-grow text-base py-3">
          <Wand2 className="mr-2 h-5 w-5" />
          {isLoading ? '분석 중...' : '코드 분석'}
        </Button>
      </CardFooter>
    </Card>
  );
};
