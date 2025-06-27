
"use client";

import type React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BotMessageSquare, BookOpenText, HelpCircle } from 'lucide-react';
import type { SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { ApiExamplesDialog } from './ApiExamplesDialog'; // Import the new dialog

interface AnalysisSummaryDisplayProps {
  analysisResult: SummarizeCodeStructureOutput | null;
  isLoading: boolean;
  userCodeContext?: string; // For providing context to API examples
}

export const AnalysisSummaryDisplay: React.FC<AnalysisSummaryDisplayProps> = ({ analysisResult, isLoading, userCodeContext }) => {
  const [selectedApiForDialog, setSelectedApiForDialog] = useState<string | null>(null);
  const [isApiExamplesDialogOpen, setIsApiExamplesDialogOpen] = useState(false);

  const handleApiClick = (apiName: string) => {
    setSelectedApiForDialog(apiName);
    setIsApiExamplesDialogOpen(true);
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BotMessageSquare className="h-6 w-6 text-primary" />
            AI 분석 요약
          </CardTitle>
          <CardDescription>
            코드 구조, 기능 및 사용된 기술 개요입니다. API/라이브러리 이름을 클릭하여 예제를 보세요.
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
                    <ul className="list-none pl-0 space-y-1 text-sm">
                      {analysisResult.usedLibrariesAndAPIs.map((lib, index) => (
                        <li key={index} className="break-all">
                          <Button
                            variant="link"
                            className="p-0 h-auto text-sm font-normal text-accent hover:underline"
                            onClick={() => handleApiClick(lib.name)}
                            title={`'${lib.name}' 사용 예제 보기`}
                          >
                            <HelpCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
                            {lib.name}
                          </Button>
                        </li>
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
      {selectedApiForDialog && (
        <ApiExamplesDialog
          apiName={selectedApiForDialog}
          isOpen={isApiExamplesDialogOpen}
          onOpenChange={setIsApiExamplesDialogOpen}
          userCodeContext={userCodeContext}
        />
      )}
    </>
  );
};
