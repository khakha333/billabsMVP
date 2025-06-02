"use client";

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { BotMessageSquare, BookOpenText } from 'lucide-react';
import type { SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';

interface AnalysisSummaryDisplayProps {
  analysisResult: SummarizeCodeStructureOutput | null;
  isLoading: boolean;
}

export const AnalysisSummaryDisplay: React.FC<AnalysisSummaryDisplayProps> = ({ analysisResult, isLoading }) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BotMessageSquare className="h-6 w-6 text-primary" />
          AI 분석 요약
        </CardTitle>
        <CardDescription>
          코드 구조, 기능 및 사용된 기술 개요입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-5/6" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-1/2 mt-3" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : analysisResult ? (
            <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
              <div className="whitespace-pre-wrap">
                <p>{analysisResult.summary}</p>
              </div>
              {analysisResult.usedLibrariesAndAPIs && analysisResult.usedLibrariesAndAPIs.length > 0 && (
                <>
                  <h4 className="mt-4 mb-2 text-md font-semibold flex items-center gap-2">
                    <BookOpenText className="h-5 w-5 text-primary" />
                    사용된 라이브러리 및 API:
                  </h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    {analysisResult.usedLibrariesAndAPIs.map((lib, index) => (
                      <li key={index} className="break-all">{lib}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              사용 가능한 요약이 없습니다. 코드를 붙여넣고 "코드 분석"을 클릭하여 생성하세요.
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
