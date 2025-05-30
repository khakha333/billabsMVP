"use client";

import type React from 'react';
import { CodeToken } from './CodeToken';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface CodeDisplayProps {
  code: string;
}

// Improved tokenizer: handles spaces, newlines, and keeps punctuation/operators as separate tokens.
const tokenizeCode = (code: string): string[] => {
  if (!code) return [];
  // Regex to split by delimiters (whitespace, punctuation, operators) while keeping them
  // It prioritizes multi-character operators.
  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|>>>=|>>>|<<=|>>=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\*\*|\+\+|--|=>|[().,{}[\];:\-+*/%&|^~<>?=]|\s+)/g;
  return code.split(regex).filter(token => token !== undefined && token !== ''); // Filter out empty strings from split
};


export const CodeDisplay: React.FC<CodeDisplayProps> = ({ code }) => {
  const tokens = tokenizeCode(code);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileText className="h-6 w-6 text-primary" />
          대화형 코드 보기
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words bg-background rounded-md">
            <code>
              {tokens.map((token, index) => (
                <CodeToken key={index} token={token} fullCodeContext={code} />
              ))}
            </code>
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
