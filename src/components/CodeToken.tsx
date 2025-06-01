
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
  if (token.startsWith('//') || (token.startsWith('/*') && token.endsWith('*/')) || token.startsWith('#')) {
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
  // A more robust way to find the line might involve character offsets or a more complex search
  // if the tokenValue itself can span multiple lines (e.g. multi-line comments/strings).
  // For single-line tokens or first line of multi-line, this should be okay.
  const ances = spanElement.parentElement;
  if(ances) {
    const lineNumStr = ances.dataset.lineNuber; // Assuming we add data-line-number to parent <code> or <pre>
    if(lineNumStr) {
      const lineNum = parseInt(lineNumStr, 10);
      if(!isNaN(lineNum) && lineNum > 0 && lineNum <= lines.length) {
        return lines[lineNum-1].trim();
      }
    }
  }

  for (const line of lines) {
      if (line.includes(tokenValue)) { // This might be problematic if token is very common or part of a larger construct
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
  const [explainedSegment, setExplainedSegment] = useState<string | null>(null); // Store what was actually explained

  const tokenType = getTokenType(token);

  const isExplainable =
    token.trim().length > 0 &&
    (tokenType === 'identifier' ||
      tokenType === 'string' ||
      tokenType === 'comment' || // Now includes '#' comments
      tokenType === 'constant-convention'
    ) && !KEYWORDS.has(token);


  const handleFetchExplanation = async (segmentToExplain: string) => {
    if (isLoading && segmentToExplain === explainedSegment) { // Already loading this exact segment
      return;
    }
    if (!isLoading && segmentToExplain === explainedSegment && explanation) { // Already have explanation for this exact segment
      return; 
    }
    
    setExplanation(null); 
    setExplainedSegment(segmentToExplain); // Set what we are fetching
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
     setExplainedSegment(lineOfCode); // Set what we are fetching
     setIsLoading(true);
     try {
        // Ensure the input to explainCodeLineAction matches ExplainCodeLineInput (alias for ExplainCodeSegmentInput)
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
    // Reset explanations if token or context changes to avoid showing stale data.
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
        // Only fetch if it's a new line or no explanation yet for this line
        if (line !== explainedSegment || !lineExplanation) { 
            handleFetchLineExplanation(line);
        }
      }
    } else {
      // `token` is already the full string, comment, or identifier.
      // Only fetch if it's a new token or no explanation yet for this token.
      if (token !== explainedSegment || !explanation) { 
        handleFetchExplanation(token);
      }
    }
  };


  if (token === '\n') {
    return <br />;
  }
  if (token.match(/^\s+$/) && token !== '\n') {
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
    // Fallback messages if content isn't loaded yet, or if still loading a different segment
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
          const shiftKeyActive = (window.event as MouseEvent)?.shiftKey; // Check current shift state
          setIsShiftPressed(!!shiftKeyActive); // Update state based on current event

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
          <TooltipContent side="top" align="start" className="max-w-md bg-popover text-popover-foreground p-3 rounded-md border shadow-xl text-sm whitespace-pre-wrap">
            {tooltipText()}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
