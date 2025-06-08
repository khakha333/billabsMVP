
"use client";

import type { Metadata } from 'next';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, FolderKanban, Wand2, MessagesSquare, FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Client-side dynamic title setting
// export const metadata: Metadata = {
//   title: '프로젝트 도우미 - 코드 인사이트',
//   description: 'AI를 통해 프로젝트 구조를 분석하고 코드 수정을 받아보세요.',
// };

export default function ProjectHelperPage() {
  const [projectInput, setProjectInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.title = '프로젝트 도우미 - 코드 인사이트';
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setProjectInput(text);
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

  const handleAnalyzeProject = async () => {
    if (!projectInput.trim()) {
      toast({
        title: "입력 오류",
        description: "분석할 프로젝트 정보를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingAnalysis(true);
    setAnalysisResult(null);
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAnalysisResult(`프로젝트 분석 결과:\n입력된 정보는 ${projectInput.length}자 입니다.\n(실제 분석 로직이 여기에 추가될 것입니다.)`);
    setIsLoadingAnalysis(false);
    toast({
      title: "프로젝트 분석 시작",
      description: "AI가 프로젝트 분석을 시작합니다. (데모)",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="py-4 px-6 border-b border-border shadow-sm bg-card sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              프로젝트 도우미
            </h1>
          </div>
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-5 w-5" />
              메인으로 돌아가기
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Project Input */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <Card className="flex flex-col flex-grow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wand2 className="h-5 w-5" />
                프로젝트 정보 입력
              </CardTitle>
              <CardDescription>
                프로젝트 구조(예: `tree` 명령어 결과), 주요 파일 내용(`package.json` 등), 또는 단일 중요 파일의 내용을 붙여넣거나 아래 버튼으로 업로드하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <Textarea
                value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                placeholder="여기에 프로젝트 관련 정보를 붙여넣거나 파일을 업로드하세요..."
                className="h-full w-full resize-none font-mono text-sm p-3 rounded-md shadow-inner flex-grow min-h-[200px]"
                aria-label="Project input area"
                disabled={isLoadingAnalysis}
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
              <Button onClick={handleUploadButtonClick} variant="outline" className="w-full sm:w-auto" disabled={isLoadingAnalysis}>
                <FileUp className="mr-2 h-5 w-5" />
                파일 내용 불러오기
              </Button>
              <Button 
                onClick={handleAnalyzeProject} 
                disabled={isLoadingAnalysis || !projectInput.trim()} 
                className="w-full sm:w-auto flex-grow"
              >
                <Wand2 className="mr-2 h-5 w-5" />
                {isLoadingAnalysis ? '분석 중...' : '프로젝트 분석 요청'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Analysis and Agent Interaction */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          <Card className="flex-grow flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessagesSquare className="h-5 w-5" />
                AI 분석 및 수정 제안 (에이전트)
              </CardTitle>
              <CardDescription>
                프로젝트 분석 결과와 코드 수정 제안이 여기에 표시됩니다. AI 에이전트와 대화하여 코드를 변경할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ScrollArea className="h-full min-h-[300px] p-1 border rounded-md bg-muted/30">
                {isLoadingAnalysis && (
                  <div className="p-4 text-center text-muted-foreground">
                    <p>프로젝트 정보를 분석 중입니다...</p>
                    <p className="animate-pulse">잠시만 기다려주세요.</p>
                  </div>
                )}
                {!isLoadingAnalysis && analysisResult && (
                  <pre className="p-4 text-sm whitespace-pre-wrap">{analysisResult}</pre>
                )}
                {!isLoadingAnalysis && !analysisResult && (
                  <div className="p-4 text-center text-muted-foreground h-full flex flex-col justify-center items-center">
                    <FolderKanban className="h-12 w-12 mb-4 opacity-50" />
                    <p>왼쪽에 프로젝트 정보를 입력하고 "프로젝트 분석 요청" 버튼을 누르세요.</p>
                    <p className="text-xs mt-2">AI가 구조를 파악하고 수정 제안을 준비합니다.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        코드 인사이트 &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    