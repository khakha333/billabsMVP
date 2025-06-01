
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
    /(?:\/\/.*|\/\*[\s\S]*?\*\/|#.*)/, // Comments (//, /* */, #)
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/, // String literals
    /\b(?:function|const|let|var|return|if|else|for|while|switch|case|default|try|catch|finally|class|extends|super|this|new|delete|typeof|instanceof|void|yield|async|await|import|export|from|as|get|set|static|public|private|protected|readonly|enum|interface|type|namespace|module|debugger|with|true|false|null|undefined|def)\b/, // Keywords (added 'def' for Python)
    /[a-zA-Z_]\w*/, // Identifiers
    /\d+(?:\.\d*)?|\.\d+/, // Numbers
    />>>=|<<=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\*\*|\+\+|--|=>|[().,{}[\];:\-+*\/%&|^~<>?=]/, // Operators and Punctuation (multi-char first)
    /\s+/, // Whitespace
    /./, // Any other character
  ];
  const combinedRegex = new RegExp(tokenPatterns.map(r => `(${r.source})`).join('|'), 'g');

  const tokens: string[] = [];
  let match;
  // Using matchAll to ensure full patterns are captured as single tokens where appropriate
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

  // List of common method names that are often simple utilities or built-ins,
  // for which a magic wand might be less useful in JS/TS method contexts.
  const commonMethodNamesToExcludeForJsTs = [
    'print', 'exit', 'log', 'warn', 'error', 'info', 'debug', 'assert',
    'toString', 'valueOf', 'constructor', // constructor is often boilerplate
    // Add more if needed, e.g., common lifecycle methods like 'render', 'componentDidMount'
    // or very simple utility names if they become problematic.
  ];

  // 0. Python function: def foo(...):
  match = line.match(/^\s*def\s+([a-zA-Z_]\w*)\s*\([^)]*\)\s*:/);
  if (match) return match[1]; // No exclusion for Python 'def' names

  // 1. function keyword: function foo(...), async function foo(...)
  match = line.match(/^\s*(async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/);
  if (match) return match[2]; // No exclusion for explicitly declared 'function'

  // 2. Arrow functions assigned to variables: const foo = (...) =>, let bar = async () =>
  match = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\(.*\)\s*=>/);
  if (match) return match[1]; // No exclusion for assigned arrow functions

  // 3. Function expressions assigned to variables: const foo = function(...), let bar = async function baz(...)
  match = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(async\s+)?function(?:\s+([a-zA-Z_$][\w$]*))?\s*\(/);
  if (match) return match[1];  // No exclusion for assigned function expressions

  // 4. Object methods (colon syntax): foo: function(...), bar: async function()
  match = line.match(/^\s*([a-zA-Z_$][\w$]*)\s*:\s*(async\s+)?function\s*\(/);
  if (match) {
    const potentialName = match[1];
    if (!commonMethodNamesToExcludeForJsTs.includes(potentialName)) {
      return potentialName;
    }
  }
  
  // 5. ES6 method syntax in objects/classes: myMethod(...), async myMethod(...), get myProp(){}, set myProp(val){}, *myGenerator()
  // Also captures class constructors: constructor()
  const es6MethodRegex = /^\s*(static\s+)?(async\s+)?(get\s+|set\s+|\*)?([a-zA-Z_$][\w$]*|constructor)\s*\(([^)]*)\)\s*\{/;
  match = line.match(es6MethodRegex);
   if (match) {
    const potentialName = match[4];
    const syntaxKeywordsToExclude = ['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'super', 'new', 'delete', 'void', 'instanceof', 'with'];
    if (!syntaxKeywordsToExclude.includes(potentialName) && !commonMethodNamesToExcludeForJsTs.includes(potentialName)) {
      return potentialName;
    }
  }
  // Simpler version for ES6 methods that might not end with { (e.g. interfaces, abstract methods)
  // or if there's content between () and { like type definitions.
  const es6MethodRegexSimple = /^\s*(static\s+)?(async\s+)?(get\s+|set\s+|\*)?([a-zA-Z_$][\w$]*|constructor)\s*\(([^)]*)\)/;
   match = line.match(es6MethodRegexSimple);
   if (match) {
    const potentialName = match[4];
    const syntaxKeywordsToExclude = ['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'super', 'new', 'delete', 'void', 'instanceof', 'with'];
    // Check if it's not an arrow function context and if the line seems to define a method body or is an abstract/interface-like signature
    if (!syntaxKeywordsToExclude.includes(potentialName) && 
        !commonMethodNamesToExcludeForJsTs.includes(potentialName) &&
        !line.includes('=>') && 
        (line.includes('{') || line.trim().endsWith(')') || line.match(/\)\s*;/)) // Added check for ); for abstract/interface methods
    ) { 
      return potentialName;
    }
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
  const [currentDialogTitle, setCurrentDialogTitle] = useState<string>("코드 설명");
  const [currentSegmentForDialogExplanation, setCurrentSegmentForDialogExplanation] = useState<string | null>(null);


  const handleMouseUp = () => {
    if (!codeDisplayRef.current) return;

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
  }, [code]); 

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


  const getExplainButtonStyle = (): React.CSSProperties => {
    if (!selectionRect || !codeDisplayRef.current) return { display: 'none' };
    
    const codeDisplayDiv = codeDisplayRef.current;
    const containerRect = codeDisplayDiv.getBoundingClientRect();
    const scrollArea = codeDisplayDiv.querySelector('[data-radix-scroll-area-viewport]');
    
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
             setSelectionRect(null); 
          }
        }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                {currentDialogTitle}
            </DialogTitle>
            <DialogDescription>AI가 생성한 코드 조각에 대한 설명입니다.</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-2">
            {selectedTextForDialog && ( 
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

