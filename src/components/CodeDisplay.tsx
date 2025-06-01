
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

// Improved tokenizer: handles spaces, newlines, and keeps punctuation/operators as separate tokens.
const tokenizeCode = (code: string): string[] => {
  if (!code) return [];
  // Regex to split by delimiters (whitespace, punctuation, operators) while keeping them
  // It prioritizes multi-character operators. Also handles comments.
  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|>>>=|>>>|<<=|>>=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\*\*|\+\+|--|=>|[().,{}[\];:\-+*/%&|^~<>?=]|\s+|[^\s\w().,{}[\];:\-+*/%&|^~<>?=]+)/g;
  return code.split(regex).filter(token => token !== undefined && token !== ''); // Filter out empty strings from split
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

    if (text && text.length > 0 && selection && codeDisplayRef.current.contains(selection.anchorNode) ) {
      setSelectedText(text);
      const range = selection.getRangeAt(0);
      setSelectionRect(range.getBoundingClientRect());
      setExplanationForSelection(null); // Clear previous explanation
      // Do not open dialog immediately, button will trigger it
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
  }, [code]); // Rerun if code changes, to ensure selection context is fresh

  const handleExplainSelection = async () => {
    if (!selectedText) return;
    setIsLoadingSelectionExplanation(true);
    setShowSelectionExplanationDialog(true); // Open dialog
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
    
    const containerRect = codeDisplayRef.current.getBoundingClientRect();
    // Position button slightly above and to the right of the selection end
    // Adjust these offsets as needed
    let top = selectionRect.bottom - containerRect.top + window.scrollY + 5;
    let left = selectionRect.right - containerRect.left + window.scrollX - 20; // Move left a bit to not obscure selection end

    // Keep button within visible area of the code display card
    top = Math.max(5, Math.min(top, containerRect.height - 30)); // 30px is approx button height
    left = Math.max(5, Math.min(left, containerRect.width - 150)); // 150px is approx button width

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
          if (!isOpen) { // Reset selection when dialog closes
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
