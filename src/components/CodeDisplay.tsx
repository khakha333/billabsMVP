
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

// New tokenizer using matchAll to capture full strings, comments, etc.
const tokenizeCode = (code: string): string[] => {
  if (!code) return [];

  const tokenPatterns = [
    /(?:\/\/[^\n]*|\/\*(?:[\s\S]*?)\*\/)/, // JS/TS Comments (line and block)
    /(?:#.*)/, // Python-style or similar comments starting with #
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/, // String literals
    // Keywords (ensure \b for whole word matching)
    /\b(?:function|const|let|var|return|if|else|for|while|switch|case|default|try|catch|finally|class|extends|super|this|new|delete|typeof|instanceof|void|yield|async|await|import|export|from|as|get|set|static|public|private|protected|readonly|enum|interface|type|namespace|module|debugger|with|true|false|null|undefined)\b/,
    /[a-zA-Z_]\w*/, // Identifiers (including function names not matching keywords)
    /\d+(?:\.\d*)?|\.\d+/, // Numbers
    />>>=|<<=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\*\*|\+\+|--|=>|[().,{}[\];:\-+*/%&|^~<>?=]/, // Operators and Punctuation (prioritize multi-char)
    /\s+/, // Whitespace
    /./, // Any other single character (fallback, should ideally not be hit often if regex is comprehensive)
  ];
  const combinedRegex = new RegExp(tokenPatterns.map(r => `(${r.source})`).join('|'), 'g');

  const tokens: string[] = [];
  let match;
  while ((match = combinedRegex.exec(code)) !== null) {
    // Find the first non-null capturing group
    // Start from index 1 because index 0 is the full match
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        tokens.push(match[i]);
        break;
      }
    }
  }
  return tokens;
};


export const CodeDisplay: React.FC<CodeDisplayProps> = ({ code }) => {
  const tokens = tokenizeCode(code);
  const codeDisplayRef = useRef<HTMLDivElement>(null);

  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [explanationForSelection, setExplanationForSelection] = useState<string | null>(null);
  const [isLoadingSelectionExplanation, setIsLoadingSelectionExplanation] = useState(false);
  const [showSelectionExplanationDialog, setShowSelectionExplanationDialog] = useState(false);

  const handleMouseUp = () => {
    if (!codeDisplayRef.current) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0 && selection && selection.anchorNode && codeDisplayRef.current.contains(selection.anchorNode) ) {
      setSelectedText(text);
      const range = selection.getRangeAt(0);
      setSelectionRect(range.getBoundingClientRect());
      setExplanationForSelection(null);
    } else {
      setSelectedText(null);
      setSelectionRect(null);
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [code]);

  const handleExplainSelection = async () => {
    if (!selectedText) return;
    setIsLoadingSelectionExplanation(true);
    setShowSelectionExplanationDialog(true);
    try {
      const result: ExplainCodeSegmentOutput = await explainCodeSegmentAction({ code: code, codeSegment: selectedText });
      setExplanationForSelection(result.explanation);
    } catch (error) {
      console.error("Error explaining selection:", error);
      setExplanationForSelection("선택된 코드에 대한 설명을 가져올 수 없습니다.");
    } finally {
      setIsLoadingSelectionExplanation(false);
    }
  };

  const getExplainButtonStyle = (): React.CSSProperties => {
    if (!selectionRect || !codeDisplayRef.current) return { display: 'none' };

    const containerRect = codeDisplayRef.current.getBoundingClientRect(); // Viewport rect of the Card (codeDisplayRef)

    // Calculate position relative to the Card's top-left corner
    // selectionRect.bottom is viewport bottom of selection
    // containerRect.top is viewport top of Card
    // So, (selectionRect.bottom - containerRect.top) is the offset from Card's top to selection's bottom
    let top = selectionRect.bottom - containerRect.top + 5; // +5 for spacing below selection
    // (selectionRect.right - containerRect.left) is offset from Card's left to selection's right
    // Adjust to position button near the end of selection, shifted left by approx half its width or a fixed amount
    let left = selectionRect.right - containerRect.left - 80; // Adjust this value to position button better

    // Ensure the button doesn't go outside the Card's boundaries.
    const buttonHeight = 36; // Approx height of Button size="sm" (h-9 is 36px)
    const buttonWidth = 160; // Approx width for "선택 영역 설명" + icon

    // Clamp top position
    top = Math.max(5, Math.min(top, containerRect.height - buttonHeight - 5)); // Ensure space at bottom
    // Clamp left position
    left = Math.max(5, Math.min(left, containerRect.width - buttonWidth - 5)); // Ensure space at right

    return {
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10,
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
            <code>
              {tokens.map((token, index) => (
                <CodeToken key={index} token={token} fullCodeContext={code} />
              ))}
            </code>
          </pre>
        </ScrollArea>
      </CardContent>

      {selectedText && selectionRect && (
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

      <Dialog open={showSelectionExplanationDialog} onOpenChange={(isOpen) => {
          setShowSelectionExplanationDialog(isOpen);
          if (!isOpen) {
             setSelectedText(null);
             setSelectionRect(null);
          }
        }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                선택된 코드 설명
            </DialogTitle>
            <DialogDescription>AI가 생성한 선택된 코드 조각에 대한 설명입니다.</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-2">
            <div className="selected-code-preview mb-4">
              <h4 className="text-sm font-semibold mb-1 text-muted-foreground">설명 요청한 코드:</h4>
              <ScrollArea className="max-h-40 w-full rounded-md border bg-muted p-2">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {selectedText}
                </pre>
              </ScrollArea>
            </div>

            {isLoadingSelectionExplanation ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                <p>{explanationForSelection}</p>
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

    