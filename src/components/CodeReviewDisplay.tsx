"use client";

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, Shield, Info, CheckCircle2, BotMessageSquare } from 'lucide-react';
import type { ReviewCodeOutput } from '@/ai/flows/review-code-flow';

interface CodeReviewDisplayProps {
  reviewResult: ReviewCodeOutput | null;
  isLoading: boolean;
  onSuggestionSelect: (lineStart: number, lineEnd: number) => void;
}

const severityIcons = {
  High: <AlertTriangle className="h-5 w-5 text-red-500" />,
  Medium: <Shield className="h-5 w-5 text-orange-500" />,
  Low: <Info className="h-5 w-5 text-blue-500" />,
  Info: <CheckCircle2 className="h-5 w-5 text-green-500" />,
};

const severityText = {
  High: "높음",
  Medium: "중간",
  Low: "낮음",
  Info: "정보",
};

export const CodeReviewDisplay: React.FC<CodeReviewDisplayProps> = ({ reviewResult, isLoading, onSuggestionSelect }) => {
  const suggestions = reviewResult?.suggestions || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BotMessageSquare className="h-6 w-6 text-primary" />
          AI 코드 리뷰
        </CardTitle>
        <CardDescription>
          AI가 분석한 코드 품질 및 개선 제안 사항입니다. 항목을 클릭하여 해당 코드를 확인하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
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
                  <AccordionTrigger 
                    className="text-left hover:no-underline"
                    onClick={() => onSuggestionSelect(item.lineStart, item.lineEnd)}
                  >
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
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
           {!isLoading && suggestions.length === 0 && reviewResult && (
             <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
               <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
               <p className="font-semibold">훌륭한 코드입니다!</p>
               <p className="text-sm">AI가 특별한 개선 제안 사항을 찾지 못했습니다.</p>
             </div>
           )}
           {!isLoading && !reviewResult && (
             <div className="p-4 text-center text-muted-foreground italic">
                코드를 분석하면 AI 코드 리뷰 결과가 여기에 표시됩니다.
             </div>
           )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
