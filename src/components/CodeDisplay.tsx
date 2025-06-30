
"use client";

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { CodeToken } from './CodeToken';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Wand2, MessageSquareText, MessageSquarePlus, GitCompareArrows } from 'lucide-react';
import { explainCodeSegmentAction } from '@/lib/actions';
import type { ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { useChatContext } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';

interface CodeDisplayProps {
  code: string;
  fileName?: string;
  onSegmentSelect?: (segment: string | null) => void;
  highlightedLines?: { start: number; end: number } | null;
  variant?: 'full' | 'minimal';
  className?: string;
}

const tokenizeCode = (code: string): string[] => {
  if (!code) return [];

  const tokenPatterns = [
    /(?:\/\/.*|\/\*[\s\S]*?\*\/|#.*)/, // Comments (//, /* */, #)
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/, // String literals
    /\b(?:function|const|let|var|return|if|else|for|while|switch|case|default|try|catch|finally|class|extends|super|this|new|delete|typeof|instanceof|void|yield|async|await|import|export|from|as|get|set|static|public|private|protected|readonly|enum|interface|type|namespace|module|debugger|with|true|false|null|undefined|def|print|exit)\b/, // Keywords (added def, print, exit for basic Python)
    /[a-zA-Z_]\w*/, // Identifiers
    /\d+(?:\.\d*)?|\.\d+/, // Numbers
    />>>=|<<=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\*\*|\+\+|--|=>|[().,{}[\];:\-+*\/%&|^~<>?=]/, // Operators and Punctuation
    /\s+/, // Whitespace
    /./, // Any other character (fallback)
  ];
  const combinedRegex = new RegExp(tokenPatterns.map(r => `(${r.source})`).join('|'), 'g');

  const tokens: string[] = [];
  let match;
  for (const m of code.matchAll(combinedRegex)) {
    for (let i = 1; i < m.length; i++) {
      if (m[i] !== undefined) {
        tokens.push(m[i]);
        break;
      }
    }
  }
  return tokens;
};

const extractFunctionNameFromLine = (line: string): string | null => {
  let match;
  const commonMethodNamesToExcludeForJsTs = [
    'print', 'exit', 'log', 'warn', 'error', 'info', 'debug', 'assert',
    'toString', 'valueOf', 'constructor',
  ];
  const syntaxKeywordsToExclude = ['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'super', 'new', 'delete', 'void', 'instanceof', 'with'];


  // Pattern 1: Python `def`
  match = line.match(/^\s*def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:/);
  if (match) return match[1];

  // Pattern 2: Standard `function` keyword (named or anonymous if assigned)
  match = line.match(/^\s*(async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/);
  if (match) return match[2];

  // Pattern 3: Arrow functions assigned to const/let/var
  match = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\(.*\)\s*=>/);
  if (match) return match[1];

  // Pattern 4: Function expressions assigned to const/let/var or object properties
  match = line.match(/^\s*(?:(?:const|let|var)\s+)?([a-zA-Z_$][\w$]*)\s*[:=]\s*(?:async\s+)?function(?:\s+[a-zA-Z_$][\w$]*)?\s*\(/);
  if (match) {
    const potentialName = match[1];
    if (!commonMethodNamesToExcludeForJsTs.includes(potentialName) && !syntaxKeywordsToExclude.includes(potentialName)) {
        return potentialName;
    }
  }
  
  // Pattern 5: ES6 class methods or object literal methods (simplified)
  // Covers: myMethod() {}, async myMethod() {}, get prop() {}, constructor() {}
  const es6MethodRegex = /^\s*(static\s+)?(async\s+)?(get\s+|set\s+|\*)?([a-zA-Z_$][\w$]*|constructor)\s*\(([^)]*)\)\s*(?:\{?|=>?)/;
  match = line.match(es6MethodRegex);
  if (match) {
    const potentialName = match[4];
    if (!syntaxKeywordsToExclude.includes(potentialName) && 
        !commonMethodNamesToExcludeForJsTs.includes(potentialName) &&
        (line.includes('{') || line.trim().endsWith(')') || line.match(/\)\s*;/)) // Basic check for actual definition
    ) {
      return potentialName;
    }
  }

  return null;
};


export const CodeDisplay: React.FC<CodeDisplayProps> = ({ code, fileName, onSegmentSelect, highlightedLines, variant = 'full', className }) => {
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lines = (code || '').split('\n');
  const chatContext = useChatContext();

  const [selectedTextForDialog, setSelectedTextForDialog] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [explanationForDialog, setExplanationForDialog] = useState<string | null>(null);
  const [isLoadingDialogExplanation, setIsLoadingDialogExplanation] = useState(false);
  const [showExplanationDialog, setShowExplanationDialog] = useState(false);
  const [currentDialogTitle, setCurrentDialogTitle] = useState<string>("코드 설명");
  const [currentSegmentForDialogExplanation, setCurrentSegmentForDialogExplanation] = useState<string | null>(null);


  useEffect(() => {
    if (highlightedLines && scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        const lineElement = viewport?.querySelector(`[data-line-number="${highlightedLines.start}"]`);
        if (lineElement) {
            lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [highlightedLines]);


  const handleMouseUp = () => {
    if (!codeDisplayRef.current || variant !== 'full') return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0 && selection && selection.anchorNode && codeDisplayRef.current.contains(selection.anchorNode) ) {
      setSelectedTextForDialog(text);
      const range = selection.getRangeAt(0);
      setSelectionRect(range.getBoundingClientRect());
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
  }, [code, variant]);

  const requestExplanationForSegment = async (segment: string, titleHint: string) => {
    if (!segment) return;

    setCurrentDialogTitle(titleHint ? `"${titleHint}" 설명` : "코드 설명");
    setSelectedTextForDialog(segment);

    if (isLoadingDialogExplanation && segment === currentSegmentForDialogExplanation) {
      setShowExplanationDialog(true);
      return;
    }

    if (!isLoadingDialogExplanation && explanationForDialog && segment === currentSegmentForDialogExplanation) {
      setShowExplanationDialog(true);
      return;
    }

    setIsLoadingDialogExplanation(true);
    setExplanationForDialog(null);
    setCurrentSegmentForDialogExplanation(segment);
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
    requestExplanationForSegment(functionName, functionName);
  };

  const handleExplainSelection = () => {
    if (selectedTextForDialog) {
      requestExplanationForSegment(selectedTextForDialog, selectedTextForDialog);
    }
  };

  const handleAskInChatFromDialog = () => {
    if (chatContext && currentSegmentForDialogExplanation) {
      chatContext.focusChatInput(`이 코드 조각에 대해 좀 더 자세히 설명해주세요:\n\`\`\`\n${currentSegmentForDialogExplanation}\n\`\`\``);
      setShowExplanationDialog(false);
    }
  };

  const handleAnalyzeImpactOnGraph = () => {
    if (onSegmentSelect && currentSegmentForDialogExplanation) {
      onSegmentSelect(currentSegmentForDialogExplanation);
    }
    setShowExplanationDialog(false);
  };


  const getExplainButtonStyle = (): React.CSSProperties => {
    if (!selectionRect || !codeDisplayRef.current) return { display: 'none' };

    const codeDisplayDiv = codeDisplayRef.current;
    const containerRect = codeDisplayDiv.getBoundingClientRect();
    const scrollArea = codeDisplayRef.current.querySelector('[data-radix-scroll-area-viewport]');

    let scrollTop = 0;
    let scrollLeft = 0;

    if (scrollArea) {
      scrollTop = scrollArea.scrollTop;
      scrollLeft = scrollArea.scrollLeft;
    }

    const buttonHeight = 36;
    const buttonWidth = 160;

    let top = selectionRect.bottom + 5;
    let left = selectionRect.left + (selectionRect.width / 2) - (buttonWidth / 2);

    top = top - containerRect.top + scrollTop;
    left = left - containerRect.left + scrollLeft;

    const maxTop = codeDisplayDiv.scrollHeight - buttonHeight - 5;
    const maxLeft = codeDisplayDiv.scrollWidth - buttonWidth - 5;

    top = Math.max(scrollTop + 5, Math.min(top, maxTop));
    left = Math.max(scrollLeft + 5, Math.min(left, maxLeft));

    return {
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10
    };
  };

  const isInteractive = variant === 'full';

  const codeRenderer = (
    <pre className={cn("font-mono text-sm leading-relaxed whitespace-pre-wrap break-words relative", isInteractive ? 'bg-background rounded-md p-4' : 'bg-transparent text-gray-200')}>
      {lines.map((line, lineIndex) => {
        const lineTokens = tokenizeCode(line);
        const functionName = isInteractive ? extractFunctionNameFromLine(line) : null;
        const isHighlighted = highlightedLines ? lineIndex + 1 >= highlightedLines.start && lineIndex + 1 <= highlightedLines.end : false;

        return (
          <div 
            key={lineIndex} 
            className={cn("flex items-start", isInteractive && "transition-colors duration-300", isHighlighted && "bg-primary/10 rounded-md")}
            data-line-number={lineIndex + 1}
          >
            {isInteractive && (
              <>
                <div className="line-prefix w-12 flex-shrink-0 text-right pr-2 text-muted-foreground text-xs select-none pt-[1px]">
                  {lineIndex + 1}
                </div>
                <div className="line-button-container w-6 flex-shrink-0 pt-[1px] flex items-center justify-center">
                  {functionName && (
                     <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => handleExplainFunctionByName(functionName)}
                      title={`함수 "${functionName}" 설명 보기`}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </>
            )}
            <code className="line-content flex-grow whitespace-pre break-words">
              {lineTokens.map((token, tokenIndex) => (
                <CodeToken key={tokenIndex} token={token} fullCodeContext={code} isInteractive={isInteractive} />
              ))}
            </code>
          </div>
        );
      })}
    </pre>
  );

  if (variant === 'minimal') {
    return <div className={className}>{codeRenderer}</div>;
  }

  return (
    <Card className={cn("h-full flex flex-col relative", className)} ref={codeDisplayRef}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl truncate">
          <FileText className="h-6 w-6 text-primary flex-shrink-0" />
          <span className="truncate" title={fileName}>{fileName || '대화형 코드 보기'}</span>
        </CardTitle>
        <CardDescription>
          {fileName
            ? '코드에서 함수나 특정 영역을 클릭/선택하여 AI 설명을 요청할 수 있습니다.'
            : '분석된 코드의 대화형 보기입니다.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          {codeRenderer}
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
             setSelectionRect(null);
             if (onSegmentSelect) {
                onSegmentSelect(null);
             }
          }
        }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                {currentDialogTitle}
            </DialogTitle>
            <DialogDesc>AI가 생성한 코드 조각에 대한 설명입니다.</DialogDesc>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-2">
            {currentSegmentForDialogExplanation && (
                <div className="selected-code-preview mb-4">
                <h4 className="text-sm font-semibold mb-1 text-muted-foreground">설명 요청한 코드:</h4>
                <ScrollArea className="max-h-40 w-full rounded-md border bg-muted p-2">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {currentSegmentForDialogExplanation}
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
          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
            {onSegmentSelect && (
              <Button type="button" variant="outline" onClick={handleAnalyzeImpactOnGraph} className="flex-1">
                <GitCompareArrows className="mr-2 h-4 w-4" />
                그래프에서 영향 분석
              </Button>
            )}
            {chatContext && (
                <Button type="button" variant="outline" onClick={handleAskInChatFromDialog} className="flex-1">
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                채팅으로 질문하기
                </Button>
            )}
            <DialogClose asChild>
                <Button type="button" variant="secondary" className="flex-1">
                닫기
                </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
