"use client";

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button'; // For chat link
import { MessageSquarePlus } from 'lucide-react'; // Icon for chat link
import { Skeleton } from '@/components/ui/skeleton';
import { explainCodeSegmentAction } from '@/lib/actions';
import type { ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { useChatContext } from '@/contexts/ChatContext'; // Import chat context

interface CodeTokenProps {
  token: string;
  fullCodeContext: string;
  isInteractive?: boolean;
}

const KEYWORDS = new Set([
  'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case',
  'default', 'try', 'catch', 'finally', 'class', 'extends', 'super', 'this', 'new', 'delete',
  'typeof', 'instanceof', 'void', 'yield', 'async', 'await', 'import', 'export', 'from', 'as',
  'get', 'set', 'static', 'public', 'private', 'protected', 'readonly', 'enum', 'interface',
  'type', 'namespace', 'module', 'debugger', 'with', 'true', 'false', 'null', 'undefined', 'def',
]);

const OPERATORS_PUNCTUATION = new Set([
  '+', '-', '*', '/', '%', '**', '=', '==', '===', '!=', '!==', '>', '<', '>=', '<=',
  '&', '|', '^', '~', '<<', '>>', '>>>', '&&', '||', '??', '!', '++', '--',
  '.', ',', ';', ':', '(', ')', '{', '}', '[', ']', '?', '=>', '...',
]);

const getTokenType = (token: string): string => {
  if (KEYWORDS.has(token)) {
    return 'keyword';
  }
  if ((token.startsWith("'") && token.endsWith("'")) || 
      (token.startsWith('"') && token.endsWith('"')) || 
      (token.startsWith('`') && token.endsWith('`'))) {
    return 'string';
  }
  if (token.startsWith('//') || (token.startsWith('/*') && token.endsWith('*/')) || token.startsWith('#')) {
    return 'comment';
  }
  if (OPERATORS_PUNCTUATION.has(token)) {
    if (['(', ')', '{', '}', '[', ']'].includes(token)) return 'punctuation-bracket';
    if (['.', ',', ';', ':'].includes(token)) return 'punctuation-separator';
    return 'operator';
  }
  if (!isNaN(parseFloat(token)) && isFinite(token as any) && !token.match(/^[a-zA-Z_]/)) {
    return 'number';
  }
  if (token.match(/^[A-Z_][A-Z0-9_]*$/) && token.length > 1) {
    return 'constant-convention'; 
  }
  if (token.match(/^[a-zA-Z_]\w*$/)) { 
    return 'identifier';
  }
  return 'default'; 
};


const getTokenStyle = (type: string): React.CSSProperties => {
  switch (type) {
    case 'keyword': return { color: 'var(--code-keyword-color)' };
    case 'comment': return { color: 'var(--code-comment-color)', fontStyle: 'italic' };
    case 'string': return { color: 'var(--code-string-color)' };
    case 'number': return { color: 'var(--code-number-color)' };
    case 'function-name': return { color: 'var(--code-function-name-color)', fontWeight: '500' };
    case 'identifier': return { color: 'var(--code-variable-color)' };
    case 'operator': return { color: 'var(--code-operator-color)' };
    case 'punctuation-bracket':
    case 'punctuation-separator': return { color: 'var(--code-punctuation-color)' };
    case 'constant-convention': return { color: 'var(--code-number-color)', fontWeight: '500' };
    default: return { color: 'var(--code-default-color)' };
  }
};

const getLineContainingToken = (fullCode: string, tokenValue: string, spanElement: HTMLElement | null): string => {
  if (!spanElement) return '';
  
  let currentElement: HTMLElement | null = spanElement;
  while (currentElement && !currentElement.classList.contains('line-content')) {
    currentElement = currentElement.parentElement;
  }

  if (currentElement && currentElement.parentElement) {
    const linePrefixDiv = currentElement.parentElement.querySelector('.line-prefix');
    if (linePrefixDiv && linePrefixDiv.textContent) {
      const lineNumber = parseInt(linePrefixDiv.textContent.trim(), 10);
      if (!isNaN(lineNumber) && lineNumber > 0) {
        const lines = fullCode.split('\n');
        if (lineNumber <= lines.length) {
          return lines[lineNumber - 1]; // Return the full line content
        }
      }
    }
  }
  
  // Fallback if direct line number extraction fails (less reliable)
  const lines = fullCode.split('\n');
  for (const line of lines) {
      if (line.includes(tokenValue)) {
          return line;
      }
  }
  return '';
};


export const CodeToken: React.FC<CodeTokenProps> = ({ token, fullCodeContext, isInteractive = true }) => {
  const chatContext = useChatContext();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [lineExplanation, setLineExplanation] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const tokenRef = useRef<HTMLSpanElement>(null);
  const [explainedSegment, setExplainedSegment] = useState<string | null>(null);

  const tokenType = getTokenType(token);
  const { focusChatInput } = chatContext || {};

  const isPotentiallyExplainable =
    token.trim().length > 0 &&
    (tokenType === 'identifier' ||
      tokenType === 'string' ||
      tokenType === 'comment' ||
      tokenType === 'constant-convention'
    ) && !KEYWORDS.has(token);

  const isExplainable = isInteractive && isPotentiallyExplainable;


  const handleFetchExplanation = async (segmentToExplain: string) => {
    if (isLoading && segmentToExplain === explainedSegment) {
      return;
    }
    if (!isLoading && segmentToExplain === explainedSegment && explanation) {
      return; 
    }
    
    setExplanation(null); 
    setExplainedSegment(segmentToExplain);
    setIsLoading(true);
    try {
      const result: ExplainCodeSegmentOutput = await explainCodeSegmentAction({ code: fullCodeContext, codeSegment: segmentToExplain });
      setExplanation(result.explanation);
    } catch (error) {
      console.error("Error fetching explanation:", error);
      setExplanation("이 부분에 대한 설명을 가져올 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchLineExplanation = async (lineOfCode: string) => {
     if (isLoading && lineOfCode === explainedSegment) {
        return;
     }
     if (!isLoading && lineOfCode === explainedSegment && lineExplanation) {
        return;
     }
     setLineExplanation(null);
     setExplainedSegment(lineOfCode);
     setIsLoading(true);
     try {
        const result = await explainCodeSegmentAction({ code: fullCodeContext, codeSegment: lineOfCode });
        setLineExplanation(result.explanation);
     } catch (error) {
        console.error("Error fetching line explanation:", error);
        setLineExplanation("이 라인에 대한 설명을 가져올 수 없습니다.");
     } finally {
        setIsLoading(false);
     }
  };
  
  useEffect(() => {
    setExplanation(null);
    setLineExplanation(null);
    setExplainedSegment(null);
  }, [token, fullCodeContext]);


  const onMouseEnterHandler = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!isExplainable) return;

    const shiftKeyActive = e.shiftKey;
    setIsShiftPressed(shiftKeyActive); 

    if (shiftKeyActive) {
      const line = getLineContainingToken(fullCodeContext, token, tokenRef.current);
      if (line && (line !== explainedSegment || !lineExplanation)) { 
        handleFetchLineExplanation(line);
      }
    } else {
      if (token !== explainedSegment || !explanation) { 
        handleFetchExplanation(token);
      }
    }
  };

  const handleAskInChat = () => {
    if (focusChatInput) {
      const segment = isShiftPressed ? getLineContainingToken(fullCodeContext, token, tokenRef.current) || token : token;
      focusChatInput(`이 코드 조각에 대해 더 자세히 알려줘:\n\`\`\`\n${segment}\n\`\`\``);
      setIsTooltipOpen(false); // Close tooltip after clicking
    }
  };

  const content = (
    <span
      ref={tokenRef}
      style={getTokenStyle(tokenType)}
      className={isExplainable ? "cursor-pointer hover:underline decoration-accent decoration-dotted underline-offset-2" : ""}
      onMouseEnter={isExplainable ? onMouseEnterHandler : undefined}
      onClick={isExplainable ? (e) => onMouseEnterHandler(e) : undefined}
    >
      {token}
    </span>
  );

  if (!isExplainable) {
    return content;
  }
  
  const tooltipText = () => {
    if (isLoading) {
      return (
        <div className="space-y-1.5 p-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      );
    }
    const currentText = isShiftPressed ? lineExplanation : explanation;
    if (currentText) {
      return currentText;
    }
    if (isShiftPressed) {
        if (explainedSegment && explainedSegment !== getLineContainingToken(fullCodeContext, token, tokenRef.current)) {
             return `Shift + 마우스를 올려 "${token}"(이)가 포함된 라인 설명을 가져오는 중...`;
        }
        return `Shift + 마우스를 올려 라인 설명을 가져오세요.`;
    }
    if (explainedSegment && explainedSegment !== token) {
        return `"${token}" 설명을 가져오는 중...`;
    }
    return `"${token}" 설명을 보려면 마우스를 올리세요.`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={isTooltipOpen} onOpenChange={(open) => {
        setIsTooltipOpen(open);
        if (open && isExplainable) { 
          const shiftKeyActive = (typeof window !== 'undefined' && (window.event as MouseEvent)?.shiftKey) ?? false;
          setIsShiftPressed(shiftKeyActive);

          const currentSegmentToExplain = shiftKeyActive 
            ? getLineContainingToken(fullCodeContext, token, tokenRef.current) 
            : token;
          
          if (currentSegmentToExplain) {
            if (shiftKeyActive) {
              if (currentSegmentToExplain !== explainedSegment || !lineExplanation) {
                handleFetchLineExplanation(currentSegmentToExplain);
              }
            } else {
              if (currentSegmentToExplain !== explainedSegment || !explanation) {
                handleFetchExplanation(currentSegmentToExplain);
              }
            }
          }
        }
      }}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        {isTooltipOpen && ( 
          <TooltipContent side="top" align="start" className="max-w-md bg-popover text-popover-foreground p-3 rounded-md border shadow-xl text-sm ">
            <div className="whitespace-pre-wrap">{tooltipText()}</div>
            {(explanation || lineExplanation) && !isLoading && focusChatInput && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs text-primary mt-2 flex items-center gap-1"
                onClick={handleAskInChat}
              >
                <MessageSquarePlus className="h-3 w-3" />
                채팅으로 질문하기
              </Button>
            )}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
