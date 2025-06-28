"use client";

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, Shield, Info, CheckCircle2, Wand2 } from 'lucide-react';
import type { ReviewCodeOutput, Suggestion } from '@/ai/flows/review-code-flow';
import { Button } from './ui/button';

interface CodeReviewDisplayProps {
  reviewResult: ReviewCodeOutput | null;
  isLoading: boolean;
  onSuggestionFix: (suggestion: Suggestion) => void;
}

const severityIcons = {
  High: <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />,
  Medium: <Shield className="h-5 w-5 text-orange-500 flex-shrink-0" />,
  Low: <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />,
  Info: <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />,
};

const severityText = {
  High: "높음",
  Medium: "중간",
  Low: "낮음",
  Info: "정보",
};

export const CodeReviewDisplay: React.FC<CodeReviewDisplayProps> = ({ reviewResult, isLoading, onSuggestionFix }) => {
  const suggestions = reviewResult?.suggestions || [];

  return (
    <ScrollArea className="h-full p-1">
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && suggestions.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          {suggestions.map((item, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="flex items-start gap-3 w-full">
                  {severityIcons[item.severity]}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Lines {item.lineStart}-{item.lineEnd} | 심각도: {severityText[item.severity]}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap">{item.suggestion}</p>
                <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={() => onSuggestionFix(item)}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        AI로 수정 제안 생성
                    </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      {!isLoading && reviewResult && suggestions.length === 0 && (
         <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
           <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
           <p className="font-semibold">훌륭한 코드입니다!</p>
           <p className="text-sm">AI가 특별한 개선 제안 사항을 찾지 못했습니다.</p>
         </div>
      )}
      {!isLoading && !reviewResult && (
         <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
            <Info className="h-12 w-12 text-blue-500 mb-4" />
            <p className="font-semibold">AI 코드 검토를 시작하세요</p>
            <p className="text-sm">버튼을 눌러 선택된 파일에 대한 AI 리뷰를 받아보세요.</p>
         </div>
      )}
    </ScrollArea>
  );
};
