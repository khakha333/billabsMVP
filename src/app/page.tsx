
"use client";

import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { Header } from '@/components/layout/Header';
import { CodeInputArea } from '@/components/CodeInputArea';
import { AnalysisSummaryDisplay } from '@/components/AnalysisSummaryDisplay';
import { CodeDisplay } from '@/components/CodeDisplay';
import { CodeChatInterface } from '@/components/CodeChatInterface';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCodeStructureAction, reviewCodeAction } from '@/lib/actions';
import type { SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import type { ReviewCodeOutput } from '@/ai/flows/review-code-flow';
import { ChatProvider } from '@/contexts/ChatContext';
import { CodeReviewDisplay } from '@/components/CodeReviewDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function CodeInsightsPage() {
  const [inputCode, setInputCode] = useState<string>('');
  const [displayedCode, setDisplayedCode] = useState<string>('');
  
  const [analysisResult, setAnalysisResult] = useState<SummarizeCodeStructureOutput | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewCodeOutput | null>(null);

  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  
  const [highlightedLines, setHighlightedLines] = useState<{ start: number; end: number } | null>(null);

  const { toast } = useToast();

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const focusChatInput = (prefillText?: string) => {
    chatContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
        chatInputRef.current?.focus();
        if (prefillText && chatInputRef.current) {
            chatInputRef.current.value = prefillText;
            const event = new Event('input', { bubbles: true });
            chatInputRef.current.dispatchEvent(event);
        }
    }, 100);
  };


  const handleAnalyzeCode = async (codeInput: string) => {
    setIsLoadingAnalysis(true);
    setIsLoadingReview(true);
    setAnalysisResult(null);
    setReviewResult(null);
    setHighlightedLines(null);
    setInputCode(codeInput);
    setDisplayedCode(codeInput);

    try {
      const [analysis, review] = await Promise.all([
        analyzeCodeStructureAction({ code: codeInput }),
        reviewCodeAction({ code: codeInput })
      ]);
      
      setAnalysisResult(analysis);
      setReviewResult(review);
      toast({
        title: "분석 완료",
        description: "코드 요약, 라이브러리 및 코드 리뷰 정보가 생성되었습니다.",
      });
    } catch (error) {
      console.error("Analysis or Review error:", error);
      let errorMessage = "코드 분석 또는 리뷰에 실패했습니다.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setAnalysisResult({ summary: `오류: ${errorMessage}`, usedLibrariesAndAPIs: [] });
      setReviewResult({ suggestions: [] });
      toast({
        title: "분석 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalysis(false);
      setIsLoadingReview(false);
    }
  };

  const handleSuggestionSelect = (lineStart: number, lineEnd: number) => {
    setHighlightedLines({ start: lineStart, end: lineEnd });
  };

  const handleExport = () => {
    if (!inputCode) {
      toast({
        title: "내보내기 오류",
        description: "내보낼 코드가 없습니다. 먼저 코드를 분석해주세요.",
        variant: "destructive",
      });
      return;
    }

    const librariesText = analysisResult?.usedLibrariesAndAPIs?.map(lib => `- ${lib.name}: ${lib.insight}`).join('\n') 
      || '감지된 라이브러리 또는 API가 없습니다.';
    
    const reviewText = reviewResult?.suggestions?.map(s => 
      `- [${s.severity}] Lines ${s.lineStart}-${s.lineEnd}: ${s.title}\n  ${s.suggestion}`
    ).join('\n') || '코드 리뷰 제안이 없습니다.';

    const content = `// ========= 코드 인사이트 내보내기 =========

// 원본 코드:
// ------------------------------------
${inputCode}

// AI 생성 요약:
// ------------------------------------
${analysisResult?.summary || '사용 가능한 요약이 없습니다.'}

// 사용된 라이브러리 및 API:
// ------------------------------------
${librariesText}

// AI 코드 리뷰:
// ------------------------------------
${reviewText}
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
      description: "코드, 요약 및 리뷰가 code_insights_export.txt 파일로 내보내졌습니다.",
    });
  };

  const isLoading = isLoadingAnalysis || isLoadingReview;

  return (
    <ChatProvider focusChatInput={focusChatInput}>
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
          {/* ---- Left Column ---- */}
          <div className="lg:w-[40%] xl:w-1/3 flex flex-col gap-6">
            <CodeInputArea onAnalyze={handleAnalyzeCode} isLoading={isLoading} />
            
            <Tabs defaultValue="summary" className="w-full flex-grow flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">분석 요약</TabsTrigger>
                <TabsTrigger value="review" disabled={!reviewResult && !isLoadingReview}>AI 리뷰</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="mt-4 flex-grow">
                <AnalysisSummaryDisplay 
                  analysisResult={analysisResult} 
                  isLoading={isLoadingAnalysis}
                  userCodeContext={inputCode}
                />
              </TabsContent>
              <TabsContent value="review" className="mt-4 flex-grow">
                <CodeReviewDisplay 
                  reviewResult={reviewResult} 
                  isLoading={isLoadingReview}
                  onSuggestionSelect={handleSuggestionSelect}
                />
              </TabsContent>
            </Tabs>
            
            <div ref={chatContainerRef} className="min-h-[300px]">
              {inputCode ? (
                <CodeChatInterface currentCode={inputCode} chatInputRef={chatInputRef} />
              ) : (
                <div className="flex-grow flex items-center justify-center bg-card rounded-lg shadow h-full">
                  <p className="text-muted-foreground text-lg italic p-8 text-center">
                    코드를 분석하면 여기에 AI 채팅 인터페이스가 표시됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ---- Right Column ---- */}
          <div className="lg:w-[60%] xl:w-2/3 flex flex-col">
            <div className="flex-grow min-h-[400px] lg:min-h-0">
              {displayedCode ? (
                 <CodeDisplay 
                   code={displayedCode} 
                   highlightedLines={highlightedLines}
                 />
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
        <div className="mt-auto pt-4 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <Button onClick={handleExport} disabled={!inputCode} variant="outline">
              <Download className="mr-2 h-5 w-5" />
              코드 및 요약 내보내기
            </Button>
          </div>
        <footer className="py-4 text-center text-sm text-muted-foreground border-t">
          코드 인사이트 &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </ChatProvider>
  );
}
