
"use client";

import type React from 'react';
import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Wand2, UploadCloud, FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { analyzeGithubRepositoryAction } from '@/lib/actions';

interface CodeInputAreaProps {
  onAnalyze: (code: string) => void;
  isLoading: boolean;
}

export const CodeInputArea: React.FC<CodeInputAreaProps> = ({ onAnalyze, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAnalyze(inputValue);
    }
  };

  const handleFetchFromUrl = async () => {
    if (!githubUrl.trim()) return;
    setIsFetching(true);
    try {
      const result = await analyzeGithubRepositoryAction({ repositoryUrl: githubUrl });
      if (result.error) {
        toast({ title: "가져오기 실패", description: result.error, variant: "destructive" });
      } else if (result.combinedCode) {
        setInputValue(result.combinedCode);
        toast({ title: "가져오기 성공", description: `GitHub 저장소에서 ${result.fileCount}개 파일을 성공적으로 불러왔습니다.` });
      } else {
        toast({ title: "정보 없음", description: "저장소에서 분석할 수 있는 텍스트 파일을 찾지 못했습니다.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "오류", description: "코드를 가져오는 중 예상치 못한 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const content = e.target?.result;
            if (content instanceof ArrayBuffer) {
              const zip = await JSZip.loadAsync(content);
              let allCode = `// ${file.name} 압축 파일에서 추출된 코드\n// ======================================\n\n`;
              const filePromises: Promise<void>[] = [];
              
              zip.forEach((relativePath, zipEntry) => {
                const isTextFile = !zipEntry.dir && /\.(txt|md|json|html|css|js|jsx|ts|tsx|py|java|c|cpp|h|hpp|cs|go|rs|swift|kt|kts)$/i.test(zipEntry.name);
                if (isTextFile) {
                    const filePromise = zipEntry.async('string').then(fileContent => {
                        allCode += `// FILE: ${zipEntry.name}\n// --------------------------------------\n${fileContent}\n\n`;
                    });
                    filePromises.push(filePromise);
                }
              });

              await Promise.all(filePromises);
              setInputValue(allCode);
              toast({ title: "압축 파일 로드 성공", description: `"${file.name}" 파일에서 텍스트 기반 코드들을 불러왔습니다.` });
            } else {
              throw new Error("파일을 ArrayBuffer로 읽지 못했습니다.");
            }
          } catch (error) {
            console.error("Error processing zip file:", error);
            toast({ title: "압축 파일 처리 오류", description: "ZIP 파일을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
          }
        };
        reader.onerror = () => {
             toast({ title: "파일 로드 오류", description: "파일을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
            setInputValue(text);
            toast({ title: "파일 로드 성공", description: `"${file.name}" 파일의 내용이 성공적으로 로드되었습니다.` });
          } else {
            toast({ title: "파일 로드 실패", description: "파일 내용을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
          }
        };
        reader.onerror = () => {
          toast({ title: "파일 로드 오류", description: "파일을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
        };
        reader.readAsText(file);
      }
    }
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
          AI 기반 분석 및 설명을 받으려면 아래에 코드 스니펫을 붙여넣거나, 파일을 업로드하거나, GitHub 저장소 링크를 이용하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-4">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="여기에 코드를 붙여넣으세요..."
          className="h-full w-full resize-none font-mono text-sm p-3 rounded-md shadow-inner flex-grow"
          aria-label="Code input area"
          disabled={isLoading || isFetching}
        />
        <div className="space-y-2">
          <Label htmlFor="github-url">또는 GitHub 저장소 URL에서 가져오기</Label>
          <div className="flex items-center gap-2">
            <Input
              id="github-url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="h-10"
              disabled={isLoading || isFetching}
            />
            <Button onClick={handleFetchFromUrl} disabled={isLoading || isFetching || !githubUrl.trim()} className="shrink-0">
              {isFetching ? '가져오는 중...' : '저장소 분석'}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.swift,.kt,.kts,.html,.css,.json,.md,.txt,.zip"
          className="hidden"
        />
        <Button onClick={handleUploadButtonClick} variant="outline" className="w-full sm:w-auto" disabled={isLoading || isFetching}>
          <FileUp className="mr-2 h-5 w-5" />
          파일 업로드 (.zip 포함)
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || isFetching || !inputValue.trim()} className="w-full sm:w-auto flex-grow text-base py-3">
          <Wand2 className="mr-2 h-5 w-5" />
          {isLoading ? '분석 중...' : '코드 분석'}
        </Button>
      </CardFooter>
    </Card>
  );
};
