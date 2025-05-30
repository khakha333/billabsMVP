"use client";

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { BotMessageSquare } from 'lucide-react';

interface AnalysisSummaryDisplayProps {
  summary: string | null;
  isLoading: boolean;
}

export const AnalysisSummaryDisplay: React.FC<AnalysisSummaryDisplayProps> = ({ summary, isLoading }) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BotMessageSquare className="h-6 w-6 text-primary" />
          AI 분석 요약
        </CardTitle>
        <CardDescription>
          코드 구조 및 기능 개요입니다.
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
            </div>
          ) : summary ? (
            <div className="prose prose-sm max-w-none text-foreground dark:prose-invert whitespace-pre-wrap">
              <p>{summary}</p>
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
