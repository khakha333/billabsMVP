
"use client";

import { useState, useRef, useEffect, type RefObject } from 'react';
import type React from 'react';
import { Header } from '@/components/layout/Header';
import { CodeInputArea } from '@/components/CodeInputArea';
import { AnalysisSummaryDisplay } from '@/components/AnalysisSummaryDisplay';
import { CodeDisplay } from '@/components/CodeDisplay';
import { CodeChatInterface } from '@/components/CodeChatInterface';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCodeStructureAction } from '@/lib/actions';
import type { SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { ChatProvider } from '@/contexts/ChatContext';

export default function CodeInsightsPage() {
  const [inputCode, setInputCode] = useState<string>('');
  const [displayedCode, setDisplayedCode] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<SummarizeCodeStructureOutput | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const { toast } = useToast();

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // Ref for the visible chat container

  const [isLgScreen, setIsLgScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsLgScreen(window.innerWidth >= 1024); // Tailwind's 'lg' breakpoint is 1024px
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const focusChatInput = (prefillText?: string) => {
    chatContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
        chatInputRef.current?.focus();
        if (prefillText && chatInputRef.current) {
            chatInputRef.current.value = prefillText;
            // Dispatch input event to ensure any state tied to textarea value updates
            const event = new Event('input', { bubbles: true });
            chatInputRef.current.dispatchEvent(event);
        }
    }, 100); // Timeout to ensure scroll completes before focus
  };


  const handleAnalyzeCode = async (codeInput: string) => {
    setIsLoadingAnalysis(true);
    setAnalysisResult(null);
    setInputCode(codeInput);
    setDisplayedCode(codeInput);

    try {
      const result: SummarizeCodeStructureOutput = await analyzeCodeStructureAction({ code: codeInput });
      setAnalysisResult(result);
      toast({
        title: "분석 완료",
        description: "코드 구조 요약 및 사용된 라이브러리/API 정보가 생성되었습니다.",
      });
    } catch (error) {
      console.error("Analysis error:", error);
      let errorMessage = "코드 분석에 실패했습니다.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setAnalysisResult({ summary: `오류: ${errorMessage}`, usedLibrariesAndAPIs: [] });
      toast({
        title: "분석 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleExport = () => {
    if (!inputCode && !analysisResult) {
      toast({
        title: "내보내기 오류",
        description: "내보낼 코드가 없습니다. 먼저 코드를 분석해주세요.",
        variant: "destructive",
      });
      return;
    }

    const librariesText = analysisResult?.usedLibrariesAndAPIs && analysisResult.usedLibrariesAndAPIs.length > 0
      ? analysisResult.usedLibrariesAndAPIs.join('\n- ')
      : '감지된 라이브러리 또는 API가 없습니다.';

    const content = `// 코드 인사이트 내보내기
// =====================

// 원본 코드:
// --------------
${inputCode}

// AI 생성 요약:
// ---------------------
${analysisResult?.summary || '사용 가능한 요약이 없습니다.'}

// 사용된 라이브러리 및 API:
// --------------------------------
${analysisResult?.usedLibrariesAndAPIs && analysisResult.usedLibrariesAndAPIs.length > 0 ? '- ' : ''}${librariesText}
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'code_insights_export.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({
      title: "내보내기 성공",
      description: "코드와 요약이 code_insights_export.txt 파일로 내보내졌습니다.",
    });
  };

  return (
    <ChatProvider focusChatInput={focusChatInput}>
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
          {/* ---- Column 1 (Left on LG / First main block on SM) ---- */}
          <div className="lg:w-1/3 flex flex-col gap-6">
            {/* Code Input Area */}
            <div className="h-auto">
              <CodeInputArea onAnalyze={handleAnalyzeCode} isLoading={isLoadingAnalysis} />
            </div>
            {/* Analysis Summary Display */}
            <div className="h-auto">
              <AnalysisSummaryDisplay analysisResult={analysisResult} isLoading={isLoadingAnalysis} />
            </div>

            {/* On LG screens: CodeChatInterface is here */}
            <div
              ref={isLgScreen ? chatContainerRef : null}
              className="hidden lg:flex flex-grow flex-col min-h-0" // flex-grow to take available space
            >
              {inputCode ? (
                <CodeChatInterface currentCode={inputCode} chatInputRef={chatInputRef} className="flex-grow" />
              ) : (
                <div className="flex-grow flex items-center justify-center bg-card rounded-lg shadow h-full min-h-[200px] lg:min-h-[300px]">
                  <p className="text-muted-foreground text-lg italic p-8 text-center">
                    코드를 분석하면 여기에 AI 채팅 인터페이스가 표시됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* On SM screens: CodeDisplay is here */}
            <div className="lg:hidden min-h-[300px] sm:min-h-[400px]">
              {displayedCode ? (
                <CodeDisplay code={displayedCode} />
              ) : (
                <div className="flex items-center justify-center bg-card rounded-lg shadow h-full">
                  <p className="text-muted-foreground text-lg italic p-8 text-center">
                    코드를 분석하면 대화형 코드 보기가 여기에 표시됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ---- Column 2 (Right on LG / Second main block on SM) ---- */}
          <div className="lg:w-2/3 flex flex-col"> {/* This column will contain one main item */}
            {/* On SM screens: CodeChatInterface is here */}
            <div
              ref={!isLgScreen ? chatContainerRef : null}
              className="lg:hidden flex-grow flex flex-col min-h-[400px]"
            >
              {inputCode ? (
                <div className="flex-grow flex flex-col min-h-0"> {/* Inner div to manage chat height */}
                   <CodeChatInterface currentCode={inputCode} chatInputRef={chatInputRef} className="flex-grow" />
                </div>
              ) : (
                <div className="flex-grow flex items-center justify-center bg-card rounded-lg shadow h-full">
                  <p className="text-muted-foreground text-lg italic p-8 text-center">
                    코드를 분석하면 여기에 AI 채팅 인터페이스가 표시됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* On LG screens: CodeDisplay is here */}
            <div className="hidden lg:flex flex-grow flex-col min-h-[400px] lg:min-h-0"> {/* flex-grow for LG */}
              {displayedCode ? (
                 <CodeDisplay code={displayedCode} />
              ) : (
                <div className="flex-grow flex items-center justify-center bg-card rounded-lg shadow h-full">
                  <p className="text-muted-foreground text-lg italic p-8 text-center">
                    코드를 분석하면 대화형 코드 보기가 여기에 표시됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
        <footer className="py-4 text-center text-sm text-muted-foreground border-t">
          코드 인사이트 &copy; {new Date().getFullYear()}
        </footer>
        <div className="mt-auto pt-4 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <Button onClick={handleExport} disabled={!inputCode && !analysisResult} variant="outline">
              <Download className="mr-2 h-5 w-5" />
              코드 및 요약 내보내기
            </Button>
          </div>
      </div>
    </ChatProvider>
  );
}
