
"use client";

import type React from 'react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Code2, Lightbulb, AlertTriangle } from 'lucide-react';
import { generateApiExamplesAction } from '@/lib/actions';
import type { GenerateApiExamplesOutput } from '@/ai/flows/generate-api-examples-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// For displaying code snippets, we might use a simplified pre/code or a lightweight syntax highlighter later.
// For now, let's use <pre> for simplicity.

interface ApiExamplesDialogProps {
  apiName: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userCodeContext?: string;
}

export const ApiExamplesDialog: React.FC<ApiExamplesDialogProps> = ({ apiName, isOpen, onOpenChange, userCodeContext }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [examplesData, setExamplesData] = useState<GenerateApiExamplesOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && apiName) {
      const fetchExamples = async () => {
        setIsLoading(true);
        setError(null);
        setExamplesData(null);
        try {
          const result = await generateApiExamplesAction({ apiName, userCodeContext });
          setExamplesData(result);
          // Check if the result indicates an error from the action (e.g. validation failed or AI error)
          if (result.examples.length === 0 && result.generalUsageNotes?.startsWith("오류:")) {
            setError(result.generalUsageNotes || result.briefDescription);
          }
        } catch (e) {
          console.error("Failed to fetch API examples:", e);
          const errorMessage = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
          setError(`API 예제를 가져오는데 실패했습니다: ${errorMessage}`);
          setExamplesData({ // Provide a fallback structure on catch
            apiName: apiName,
            briefDescription: `오류 발생: ${errorMessage}`,
            examples: [],
            generalUsageNotes: "다시 시도해주세요."
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchExamples();
    }
  }, [isOpen, apiName, userCodeContext]);

  const handleClose = () => {
    onOpenChange(false);
    // Optionally reset state if dialog is reused for different APIs quickly
    // setExamplesData(null); 
    // setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Code2 className="h-6 w-6 text-primary" />
            API: {apiName || "정보 로딩 중..."} 사용법 및 예제
          </DialogTitle>
          <DialogDescription>
            AI가 생성한 {apiName ? `'${apiName}'` : ""} API/라이브러리에 대한 설명과 코드 예제입니다.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow overflow-y-auto pr-2 py-2">
          {isLoading && (
            <div className="space-y-4 p-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-8 w-1/2 mt-4" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4 text-destructive flex flex-col items-center justify-center text-center">
              <AlertTriangle className="h-12 w-12 mb-3" />
              <p className="text-lg font-semibold">오류 발생</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!isLoading && !error && examplesData && (
            <div className="space-y-6 p-1">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  간략한 설명
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{examplesData.briefDescription}</p>
              </div>

              {examplesData.examples && examplesData.examples.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-primary">코드 예제</h3>
                  <Accordion type="single" collapsible className="w-full">
                    {examplesData.examples.map((example, index) => (
                      <AccordionItem value={`example-${index}`} key={index}>
                        <AccordionTrigger className="text-md hover:no-underline">
                          {index + 1}. {example.title}
                        </AccordionTrigger>
                        <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                          <p className="text-xs italic text-muted-foreground mb-2 whitespace-pre-wrap">{example.description}</p>
                          <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
                            <code className="font-mono">{example.codeSnippet}</code>
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {examplesData.generalUsageNotes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-primary">일반 사용 참고사항</h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{examplesData.generalUsageNotes}</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              닫기
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
};
