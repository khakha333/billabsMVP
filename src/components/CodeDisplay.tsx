
"use client";

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { CodeToken } from './CodeToken';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Wand2, MessageSquareText } from 'lucide-react';
import { explainCodeSegmentAction } from '@/lib/actions';
import type { ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';

interface CodeDisplayProps {
  code: string;
}

const tokenizeCode = (code: string): string[] => {
  if (!code) return [];

  const tokenPatterns = [
    /(?:\/\/[^\n]*|\/\*(?:[\s\S]*?)\*\/)/, 
    /(?:#.*)/, 
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/, 
    /\b(?:function|const|let|var|return|if|else|for|while|switch|case|default|try|catch|finally|class|extends|super|this|new|delete|typeof|instanceof|void|yield|async|await|import|export|from|as|get|set|static|public|private|protected|readonly|enum|interface|type|namespace|module|debugger|with|true|false|null|undefined)\b/,
    /[a-zA-Z_]\w*/, 
    /\d+(?:\.\d*)?|\.\d+/, 
    />>>=|<<=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\*\*|\+\+|--|=>|[().,{}[\];:\-+*/%&|^~<>?=]/, 
    /\s+/, 
    /./, 
  ];
  const combinedRegex = new RegExp(tokenPatterns.map(r => `(${r.source})`).join('|'), 'g');

  const tokens: string[] = [];
  let match;
  while ((match = combinedRegex.exec(code)) !== null) {
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        tokens.push(match[i]);
        break;
      }
    }
  }
  return tokens;
};

const extractFunctionNameFromLine = (line: string): string | null => {
  let match;
  // 1. function keyword: function foo(...), async function foo(...)
  match = line.match(/^\s*(async\s+)?function\s+([a-zA-Z_][\w$]*)\s*\(/);
  if (match) return match[2];

  // 2. Arrow functions: const foo = (...) =>, const foo = async (...) =>
  match = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_][\w$]*)\s*=\s*(?:async\s*)?\s*\(.*\)\s*=>/);
  if (match) return match[1];

  // 3. Function expressions: const foo = function(...), const foo = async function(...)
  match = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_][\w$]*)\s*=\s*(async\s+)?function\s*(?:\w*\s*)?\(/);
  if (match) return match[1];
  
  // 4. Object methods: foo: function(...), foo: async function(...), foo(...) { directly (ES6 method syntax)
  match = line.match(/^\s*([a-zA-Z_][\w$]*)\s*:\s*(?:async\s+)?function/);
  if (match) return match[1];

  // ES6 method syntax / class methods: myMethod(...) { or get myProp(...) { or set myProp(...) { or *myGenerator(...) {
  match = line.match(/^\s*(?:get\s+|set\s+|\*)?([a-zA-Z_][\w$]*)\s*\(/);
  if (match) {
    const potentialName = match[1];
    if (!['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'super', 'constructor'].includes(potentialName)) {
      // Check if it's likely a definition by looking for an opening brace on the same line (potentially after args)
      if (line.trim().endsWith('{') || line.match(/\)\s*\{/)) {
         return potentialName;
      }
    }
  }
  // Class constructor
  if (line.match(/^\s*constructor\s*\(/) && (line.trim().endsWith('{') || line.match(/\)\s*\{/)) ) {
    return 'constructor';
  }
  
  return null;
};


export const CodeDisplay: React.FC<CodeDisplayProps> = ({ code }) => {
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  const lines = code.split('\n');

  const [selectedTextForDialog, setSelectedTextForDialog] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [explanationForDialog, setExplanationForDialog] = useState<string | null>(null);
  const [isLoadingDialogExplanation, setIsLoadingDialogExplanation] = useState(false);
  const [showExplanationDialog, setShowExplanationDialog] = useState(false);

  const handleMouseUp = () => {
    if (!codeDisplayRef.current) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0 && selection && selection.anchorNode && codeDisplayRef.current.contains(selection.anchorNode) ) {
      setSelectedTextForDialog(text);
      const range = selection.getRangeAt(0);
      setSelectionRect(range.getBoundingClientRect());
      setExplanationForDialog(null); // Clear previous explanation
    } else {
      setSelectedTextForDialog(null);
      setSelectionRect(null);
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [code]); // Re-add listener if code changes

  const requestExplanationForSegment = async (segment: string, isSelection: boolean) => {
    if (!segment) return;
    setIsLoadingDialogExplanation(true);
    setExplanationForDialog(null); 
    if (isSelection) { // Only set selectedTextForDialog if it's from a user text selection
        setSelectedTextForDialog(segment);
    } else { // If it's from a function button, selectedTextForDialog is the function name
        setSelectedTextForDialog(segment); // For dialog title purposes
    }
    setShowExplanationDialog(true);
    try {
      const result: ExplainCodeSegmentOutput = await explainCodeSegmentAction({ code: code, codeSegment: segment });
      setExplanationForDialog(result.explanation);
    } catch (error) {
      console.error("Error explaining segment:", error);
      setExplanationForDialog("선택된 코드에 대한 설명을 가져올 수 없습니다.");
    } finally {
      setIsLoadingDialogExplanation(false);
    }
  };
  
  const handleExplainFunctionByName = (functionName: string) => {
    requestExplanationForSegment(functionName, false);
  };

  const handleExplainSelection = () => {
    if (selectedTextForDialog) {
      requestExplanationForSegment(selectedTextForDialog, true);
    }
  };


  const getExplainButtonStyle = (): React.CSSProperties => {
    if (!selectionRect || !codeDisplayRef.current) return { display: 'none' };
    const containerRect = codeDisplayRef.current.getBoundingClientRect();
    let top = selectionRect.bottom - containerRect.top + 5;
    let left = selectionRect.right - containerRect.left - 80;
    const buttonHeight = 36; 
    const buttonWidth = 160; 
    top = Math.max(5, Math.min(top, containerRect.height - buttonHeight - 5));
    left = Math.max(5, Math.min(left, containerRect.width - buttonWidth - 5));
    return { position: 'absolute', top: `${top}px`, left: `${left}px`, zIndex: 10 };
  };


  return (
    <Card className="h-full flex flex-col relative" ref={codeDisplayRef}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileText className="h-6 w-6 text-primary" />
          대화형 코드 보기
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words bg-background rounded-md relative">
            {lines.map((line, lineIndex) => {
              const lineTokens = tokenizeCode(line);
              const functionName = extractFunctionNameFromLine(line);
              return (
                <div key={lineIndex} className="flex items-start py-0.5">
                  <div className="line-prefix w-12 flex-shrink-0 text-right pr-2 text-muted-foreground text-xs select-none pt-[1px]">
                    {lineIndex + 1}
                  </div>
                  <div className="line-button-container w-6 flex-shrink-0 pt-[1px]">
                    {functionName && (
                       <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => handleExplainFunctionByName(functionName)}
                        title={`함수 ${functionName} 설명 보기`}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <code className="line-content flex-grow whitespace-pre break-words">
                    {lineTokens.map((token, tokenIndex) => (
                      <CodeToken key={tokenIndex} token={token} fullCodeContext={code} />
                    ))}
                  </code>
                </div>
              );
            })}
          </pre>
        </ScrollArea>
      </CardContent>

      {selectedTextForDialog && selectionRect && (
        <Button
          onClick={handleExplainSelection}
          variant="outline"
          size="sm"
          className="shadow-lg bg-accent text-accent-foreground hover:bg-accent/90"
          style={getExplainButtonStyle()}
        >
          <MessageSquareText className="mr-2 h-4 w-4" />
          선택 영역 설명
        </Button>
      )}

      <Dialog open={showExplanationDialog} onOpenChange={(isOpen) => {
          setShowExplanationDialog(isOpen);
          if (!isOpen) {
             setSelectedTextForDialog(null); // Clear selection context when dialog closes
             setSelectionRect(null);       // Clear selection rect as well
             setExplanationForDialog(null);
          }
        }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                코드 설명
            </DialogTitle>
            <DialogDescription>AI가 생성한 코드 조각({selectedTextForDialog ? `'${selectedTextForDialog}'` : '함수'})에 대한 설명입니다.</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-2">
            {selectedTextForDialog && ( // Only show preview if it was user-selected text
                <div className="selected-code-preview mb-4">
                <h4 className="text-sm font-semibold mb-1 text-muted-foreground">설명 요청한 코드:</h4>
                <ScrollArea className="max-h-40 w-full rounded-md border bg-muted p-2">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {selectedTextForDialog}
                    </pre>
                </ScrollArea>
                </div>
            )}

            {isLoadingDialogExplanation ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                <p>{explanationForDialog}</p>
              </div>
            )}
          </div>
           <DialogClose asChild>
            <Button type="button" variant="outline" className="mt-4">
              닫기
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
    

    