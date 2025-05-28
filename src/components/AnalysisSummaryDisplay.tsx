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
          AI Analysis Summary
        </CardTitle>
        <CardDescription>
          An overview of your code's structure and functionality.
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
              No summary available. Paste your code and click "Analyze Code" to generate one.
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
