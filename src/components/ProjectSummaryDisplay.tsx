"use client";

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, ListChecks, Architecture, Rocket } from 'lucide-react';
import type { SummarizeProjectOutput } from '@/ai/flows/summarize-project-flow';

interface ProjectSummaryDisplayProps {
  summary: SummarizeProjectOutput | null;
  isLoading: boolean;
}

export const ProjectSummaryDisplay: React.FC<ProjectSummaryDisplayProps> = ({ summary, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 animate-pulse" />
            AI 프로젝트 개요
          </CardTitle>
          <CardDescription>
            AI가 프로젝트 전체를 분석하여 요약을 생성하고 있습니다...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="pt-2">
            <Skeleton className="h-5 w-1/3 mb-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="pt-2">
            <Skeleton className="h-5 w-1/3 mb-2" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null; // Don't render anything if there's no summary and it's not loading
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-primary" />
          AI 프로젝트 개요: {summary.projectName}
        </CardTitle>
        <CardDescription>
          AI가 분석한 프로젝트의 목적, 주요 기능 및 기술 스택입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div>
            <p>{summary.summary}</p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            주요 기능
          </h3>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {summary.keyFeatures.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Architecture className="h-5 w-5 text-primary" />
            아키텍처 및 기술 스택
          </h3>
          <p className="text-muted-foreground">{summary.architecture}</p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            시작하기
          </h3>
          <p className="text-muted-foreground">
            새로운 개발자는 다음 파일을 먼저 살펴보는 것을 추천합니다: <code className="font-mono bg-muted text-muted-foreground rounded px-1 py-0.5 text-xs">{summary.gettingStarted}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
