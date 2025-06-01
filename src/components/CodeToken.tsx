
"use client";

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { explainCodeSegmentAction, explainCodeLineAction } from '@/lib/actions';
import type { ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';

interface CodeTokenProps {
  token: string;
  fullCodeContext: string;
}

const KEYWORDS = new Set([
  'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case',
  'default', 'try', 'catch', 'finally', 'class', 'extends', 'super', 'this', 'new', 'delete',
  'typeof', 'instanceof', 'void', 'yield', 'async', 'await', 'import', 'export', 'from', 'as',
  'get', 'set', 'static', 'public', 'private', 'protected', 'readonly', 'enum', 'interface',
  'type', 'namespace', 'module', 'debugger', 'with', 'true', 'false', 'null', 'undefined',
]);

const OPERATORS_PUNCTUATION = new Set([
  '+', '-', '*', '/', '%', '**', '=', '==', '===', '!=', '!==', '>', '<', '>=', '<=',
  '&', '|', '^', '~', '<<', '>>', '>>>', '&&', '||', '??', '!', '++', '--',
  '.', ',', ';', ':', '(', ')', '{', '}', '[', ']', '?', '=>', '...',
]);

// This function determines the general category of a token.
// Assumes `token` is now a fully formed unit like a whole string or comment.
const getTokenType = (token: string): string => {
  if (KEYWORDS.has(token)) {
    return 'keyword';
  }
  // Check for full string literals first, as they are now single tokens
  if ((token.startsWith("'") && token.endsWith("'")) || 
      (token.startsWith('"') && token.endsWith('"')) || 
      (token.startsWith('`') && token.endsWith('`'))) {
    return 'string';
  }
  // Check for full comments, as they are now single tokens
  if (token.startsWith('//') || token.startsWith('/*') && token.endsWith('*/')) {
    return 'comment';
  }
  if (OPERATORS_PUNCTUATION.has(token)) {
    if (['(', ')', '{', '}', '[', ']'].includes(token)) return 'punctuation-bracket';
    if (['.', ',', ';', ':'].includes(token)) return 'punctuation-separator';
    return 'operator';
  }
  if (!isNaN(parseFloat(token)) && isFinite(token as any) && !token.match(/^[a-zA-Z_]/)) { // ensure not identifier starting with number
    return 'number';
  }
  if (token.match(/^[A-Z_][A-Z0-9_]*$/) && token.length > 1) {
    return 'constant-convention'; 
  }
  // Function name detection might need refinement if the next token isn't easily available
  // For now, we'll classify potential function calls by identifier pattern
  if (token.match(/^[a-zA-Z_]\w*$/)) { 
    // A more robust check would involve parsing or looking at subsequent tokens,
    // but for basic highlighting, 'identifier' is a safe default.
    // If we want specific function name highlighting, this might need `nextToken` or context.
    // For simplicity, let's assume function-like identifiers could be function names.
    // Consider a simplified heuristic or rely on the user selecting the function call for explanation.
    // If the token is followed by '(' in the original code, it's likely a function call.
    // This check is difficult here without more context.
    // The AI explanation for 'identifier' should handle function calls if 'codeSegment' is the function name.
    return 'identifier'; // This will cover variable names and most function names
  }
  return 'default'; 
};


const getTokenStyle = (type: string): React.CSSProperties => {
  switch (type) {
    case 'keyword': return { color: 'var(--code-keyword-color)' };
    case 'comment': return { color: 'var(--code-comment-color)', fontStyle: 'italic' };
    case 'string': return { color: 'var(--code-string-color)' };
    case 'number': return { color: 'var(--code-number-color)' };
    case 'function-name': return { color: 'var(--code-function-name-color)', fontWeight: '500' }; // Kept for potential future use
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
  const lines = fullCode.split('\n');
  for (const line of lines) {
      if (line.includes(tokenValue)) {
          return line.trim();
      }
  }
  return '';
};


export const CodeToken: React.FC<CodeTokenProps> = ({ token, fullCodeContext }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [lineExplanation, setLineExplanation] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const tokenRef = useRef<HTMLSpanElement>(null);
  const [explainedSegment, setExplainedSegment] = useState<string | null>(null);

  const tokenType = getTokenType(token);

  const isExplainable =
    token.trim().length > 0 &&
    (tokenType === 'identifier' || // General identifiers, could be func names, vars
      tokenType === 'string' ||       // Full strings are explainable
      tokenType === 'comment' ||      // Full comments are explainable
      tokenType === 'constant-convention'
    ) && !KEYWORDS.has(token);


  const handleFetchExplanation = async (segmentToExplain: string) => {
    if (segmentToExplain === explainedSegment && explanation && !isLoading) {
      return; 
    }
    if (isLoading && segmentToExplain === explainedSegment) {
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
     if (lineOfCode === explainedSegment && lineExplanation && !isLoading) {
        return;
     }
     if (isLoading && lineOfCode === explainedSegment) {
        return;
     }
     setLineExplanation(null);
     setExplainedSegment(lineOfCode);
     setIsLoading(true);
     try {
        const result = await explainCodeLineAction({ code: fullCodeContext, codeSegment: lineOfCode });
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
      if (line) {
        if (line !== explainedSegment || !lineExplanation) { 
            handleFetchLineExplanation(line);
        }
      }
    } else {
      // Since `token` is now the full string or comment if `tokenType` is 'string' or 'comment',
      // we can pass `token` directly as the segment to explain.
      // For identifiers, `token` is also the segment (e.g. function name, variable).
      if (token !== explainedSegment || !explanation) { 
        handleFetchExplanation(token);
      }
    }
  };


  if (token === '\n') {
    return <br />;
  }
  if (token.match(/^\s+$/) && token !== '\n') {
    // Preserve whitespace tokens for formatting, but they are not explainable.
    // Use `whiteSpace: 'pre'` to ensure multiple spaces are rendered correctly.
    return <span style={{whiteSpace: 'pre'}}>{token}</span>;
  }
  if (token.trim() === '' && token !== '\n') {
     return <span>{token}</span>; 
  }


  const content = (
    <span
      ref={tokenRef}
      style={getTokenStyle(tokenType)}
      className={isExplainable ? "cursor-pointer hover:underline decoration-accent decoration-dotted underline-offset-2" : ""}
      onMouseEnter={isExplainable ? onMouseEnterHandler : undefined}
      onClick={isExplainable ? (e) => onMouseEnterHandler(e) : undefined} // Also trigger on click for touch devices
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
        return `Shift + 마우스를 올려 "${token}"(이)가 포함된 라인 설명을 가져오는 중... (또는 이미 가져옴)`;
    }
    return `"${token}" 설명을 보려면 마우스를 올리세요. (또는 이미 가져옴)`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={isTooltipOpen} onOpenChange={(open) => {
        setIsTooltipOpen(open);
        if (open && isExplainable) { // Fetch explanation when tooltip is about to open, if not already fetched
          const currentSegment = isShiftPressed ? getLineContainingToken(fullCodeContext, token, tokenRef.current) : token;
          if (isShiftPressed) {
            if (currentSegment && (currentSegment !== explainedSegment || !lineExplanation)) {
              handleFetchLineExplanation(currentSegment);
            }
          } else {
            if (currentSegment !== explainedSegment || !explanation) {
              handleFetchExplanation(currentSegment);
            }
          }
        }
      }}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        {isTooltipOpen && ( 
          <TooltipContent side="top" align="start" className="max-w-md bg-popover text-popover-foreground p-3 rounded-md border shadow-xl text-sm whitespace-pre-wrap">
            {tooltipText()}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
