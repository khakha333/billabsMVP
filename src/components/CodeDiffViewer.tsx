"use client";

import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { diffLines } from 'diff';

interface CodeDiffViewerProps {
  originalCode: string;
  modifiedCode: string;
  fileName?: string;
}

export const CodeDiffViewer: React.FC<CodeDiffViewerProps> = ({ originalCode, modifiedCode, fileName }) => {
  const changes = diffLines(originalCode, modifiedCode);

  let originalLineNum = 1;
  let modifiedLineNum = 1;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          코드 변경사항
        </CardTitle>
        <CardDescription>
          {fileName ? `'${fileName}' 파일의 ` : ''}AI 코드 수정 제안입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full">
          <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words bg-background rounded-md p-4">
            {changes.map((part, index) => {
              const lines = part.value.replace(/\n$/, '').split('\n');
              const partType = part.added ? 'added' : part.removed ? 'removed' : 'neutral';
              
              return (
                <div key={index} className={cn(
                  'diff-part',
                  part.added && 'bg-green-500/10',
                  part.removed && 'bg-red-500/10'
                )}>
                  {lines.map((line, lineIndex) => {
                     let displayOriginalLineNum = '';
                     let displayModifiedLineNum = '';

                     if (partType === 'removed') {
                        displayOriginalLineNum = (originalLineNum++).toString();
                     } else if (partType === 'added') {
                        displayModifiedLineNum = (modifiedLineNum++).toString();
                     } else { // neutral
                        displayOriginalLineNum = (originalLineNum++).toString();
                        displayModifiedLineNum = (modifiedLineNum++).toString();
                     }

                    return (
                        <div key={lineIndex} className="flex items-start">
                            <div className="line-numbers w-16 flex-shrink-0 text-right pr-4 text-muted-foreground text-xs select-none pt-[1px] flex">
                                <span className={cn('w-8', partType === 'added' && 'text-transparent')}>{displayOriginalLineNum}</span>
                                <span className={cn('w-8', partType === 'removed' && 'text-transparent')}>{displayModifiedLineNum}</span>
                            </div>
                            <code className="line-content flex-grow whitespace-pre break-words">
                                <span className={cn('mr-2', part.added ? 'text-green-500' : part.removed ? 'text-red-500' : 'text-muted-foreground')}>
                                    {part.added ? '+' : part.removed ? '-' : ' '}
                                </span>
                                {line}
                            </code>
                        </div>
                    );
                  })}
                </div>
              );
            })}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
