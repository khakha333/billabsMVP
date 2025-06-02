"use client";

import { useState } from 'react';
import type React from 'react';
import { Header } from '@/components/layout/Header';
import { CodeInputArea } from '@/components/CodeInputArea';
import { AnalysisSummaryDisplay } from '@/components/AnalysisSummaryDisplay';
import { CodeDisplay } from '@/components/CodeDisplay';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCodeStructureAction } from '@/lib/actions';
import type { SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';

export default function CodeInsightsPage() {
  const [inputCode, setInputCode] = useState<string>('');
  const [displayedCode, setDisplayedCode] = useState<string>(''); // Code to show in CodeDisplay
  const [analysisResult, setAnalysisResult] = useState<SummarizeCodeStructureOutput | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const { toast } = useToast();

  const handleAnalyzeCode = async (codeInput: string) => {
    setIsLoadingAnalysis(true);
    setAnalysisResult(null); // Clear previous result
    setInputCode(codeInput); // Store original input for analysis & export
    setDisplayedCode(codeInput); // Set code for display

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
    URL.revokeObjectURL(link.href); // Clean up
    toast({
      title: "내보내기 성공",
      description: "코드와 요약이 code_insights_export.txt 파일로 내보내졌습니다.",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-[calc(100vh-200px)]"> {/* Adjust min-h as needed */}
          {/* Left Pane: Code Input & Summary */}
          <div className="lg:w-1/3 flex flex-col gap-6 min-h-[300px] lg:min-h-0">
            <div className="flex-grow h-1/2 lg:h-auto">
              <CodeInputArea onAnalyze={handleAnalyzeCode} isLoading={isLoadingAnalysis} />
            </div>
            <div className="flex-grow h-1/2 lg:h-auto">
              <AnalysisSummaryDisplay analysisResult={analysisResult} isLoading={isLoadingAnalysis} />
            </div>
          </div>

          {/* Right Pane: Code Display */}
          <div className="lg:w-2/3 flex-grow min-h-[400px] lg:min-h-0">
            {displayedCode ? (
              <CodeDisplay code={displayedCode} />
            ) : (
              <div className="h-full flex items-center justify-center bg-card rounded-lg shadow">
                <p className="text-muted-foreground text-lg italic p-8 text-center">
                  코드를 분석하면 대화형 코드 보기가 여기에 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-auto pt-4 flex justify-end">
          <Button onClick={handleExport} disabled={!inputCode && !analysisResult} variant="outline">
            <Download className="mr-2 h-5 w-5" />
            코드 및 요약 내보내기
          </Button>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        코드 인사이트 &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
