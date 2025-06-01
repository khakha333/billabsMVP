
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
  // Add tokenStartIndex to help locate the token accurately if needed, though not used by current function parsing.
  // tokenStartIndex: number;
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
const getTokenType = (token: string, nextToken?: string): string => {
  if (KEYWORDS.has(token)) {
    return 'keyword';
  }
  if (OPERATORS_PUNCTUATION.has(token)) {
    if (['(', ')', '{', '}', '[', ']'].includes(token)) return 'punctuation-bracket';
    if (['.', ',', ';', ':'].includes(token)) return 'punctuation-separator';
    return 'operator';
  }
  if (token.startsWith('//') || token.startsWith('/*') || (token.startsWith('*') && token.endsWith('*/'))) {
    return 'comment';
  }
  // Ensure full string literals are captured by tokenization first.
  // This regex-based tokenizer might split strings if they contain spaces or special chars not handled.
  // Assuming tokenizer gives full strings like "'hello world'" or `"message: ${var}"`
  if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"')) || (token.startsWith('`') && token.endsWith('`'))) {
    return 'string';
  }
  if (!isNaN(parseFloat(token)) && isFinite(token as any)) {
    return 'number';
  }
  if (token.match(/^[A-Z_][A-Z0-9_]*$/) && token.length > 1) {
    return 'constant-convention'; // Typically uppercase like MY_CONSTANT
  }
   // Heuristic for function name: an identifier followed by an opening parenthesis
  if (nextToken === '(' && token.match(/^[a-zA-Z_]\w*$/)) {
     return 'function-name';
  }
  // General identifier (variables, other function names not caught by nextToken heuristic, etc.)
  if (token.match(/^[a-zA-Z_]\w*$/)) {
    return 'identifier';
  }
  return 'default'; // Includes whitespace or other unclassified tokens
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
    case 'constant-convention': return { color: 'var(--code-number-color)', fontWeight: '500' }; // Same as number or distinct
    default: return { color: 'var(--code-default-color)' };
  }
};

// Helper to find the line containing a specific token instance.
// This remains a challenge without a full AST or more detailed token info (line/char numbers from tokenizer).
// The current implementation is a placeholder and might not be perfectly accurate for repeated tokens.
const getLineContainingToken = (fullCode: string, tokenValue: string, spanElement: HTMLElement | null): string => {
  if (!spanElement) return '';

  // Attempt to find the line based on the span's text content relative to the full code.
  // This is still naive. A better way would be if tokenizer provided line numbers.
  const lines = fullCode.split('\n');
  // A very rough way to estimate the token's position for line finding.
  // This needs a more robust character-offset based search or a pre-computed token map.
  // For now, we'll iterate and find the first line that contains the token and seems to be "around" the element.
  // This is highly approximative.
  
  // Let's assume the tokenizer in CodeDisplay gives us unique spans for each token.
  // A more reliable approach if we can't get precise char indices:
  // Iterate lines, then tokenize each line and see if our token matches a token in that line
  // sequentially. This is complex without re-tokenizing.

  // Simplistic approach for now:
  for (const line of lines) {
      if (line.includes(tokenValue)) {
          // This doesn't guarantee it's *this* instance of the token.
          // A truly robust solution requires character offsets for each token.
          return line.trim();
      }
  }
  return ''; // Fallback
};


export const CodeToken: React.FC<CodeTokenProps> = ({ token, fullCodeContext }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [lineExplanation, setLineExplanation] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const tokenRef = useRef<HTMLSpanElement>(null);

  // Determine token type. We don't have nextToken here easily without map/reduce in parent.
  // So getTokenType's 'function-name' heuristic might be less effective if it relies on nextToken.
  // For now, we'll pass undefined for nextToken.
  // A better tokenizer in CodeDisplay could provide type directly.
  const tokenType = getTokenType(token);

  const isExplainable =
    token.trim().length > 0 &&
    (tokenType === 'function-name' || // Explain functions
      tokenType === 'string' ||       // Explain strings
      (tokenType === 'identifier' && !KEYWORDS.has(token)) || // Explain general identifiers (not keywords)
      (tokenType === 'constant-convention' && !KEYWORDS.has(token)) // Explain constants
    );


  const handleFetchExplanation = async (segmentToExplain: string) => {
    if (explanation || isLoading || !segmentToExplain.trim()) {
      // If already have explanation, or loading, or segment is empty, do nothing
      if (explanation && segmentToExplain === token) return; // Allow re-fetch if segment changes (e.g. for function body)
    }
    
    setExplanation(null); // Clear previous explanation for the new segment
    setIsLoading(true);
    try {
      // For function names or strings, 'token' itself is the segment. AI prompt handles context.
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
     if (lineExplanation || isLoading || !lineOfCode.trim()) {
        if (lineExplanation) return;
     }
     setLineExplanation(null);
     setIsLoading(true);
     try {
        // Assuming explainCodeLineAction expects { code: string, codeSegment: string (line) }
        const result = await explainCodeLineAction({ code: fullCodeContext, codeSegment: lineOfCode });
        setLineExplanation(result.explanation);
     } catch (error)
        {
        console.error("Error fetching line explanation:", error);
        setLineExplanation("이 라인에 대한 설명을 가져올 수 없습니다.");
     } finally {
        setIsLoading(false);
     }
  };
  
  // Effect to reset explanation when token changes, to avoid showing stale explanation
  useEffect(() => {
    setExplanation(null);
    setLineExplanation(null);
    // setIsTooltipOpen(false); // Optionally close tooltip if token under mouse changes significantly
  }, [token, fullCodeContext]);


  const onMouseEnterHandler = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!isExplainable) return;

    const shiftKeyActive = e.shiftKey;
    setIsShiftPressed(shiftKeyActive); // Update shift state

    if (shiftKeyActive) {
      const line = getLineContainingToken(fullCodeContext, token, tokenRef.current);
      if (line) {
        if (!lineExplanation) { // Fetch only if not already fetched for this line
            handleFetchLineExplanation(line);
        }
      }
    } else {
        // For tokenType 'string' or 'function-name', 'token' is the specific segment.
        // The AI prompt is now designed to handle these cases appropriately.
        if (!explanation) { // Fetch only if not already fetched for this token
            handleFetchExplanation(token);
        }
    }
  };


  if (token === '\n') {
    return <br />;
  }
  // Preserve whitespace tokens as they are crucial for formatting
  if (token.match(/^\s+$/) && token !== '\n') {
    return <span style={{whiteSpace: 'pre'}}>{token}</span>;
  }
   // Handle empty strings that might result from tokenizer if not filtered out upstream
  if (token.trim() === '' && token !== '\n') {
     return <span>{token}</span>; // Render non-newline whitespace or empty tokens
  }


  const content = (
    <span
      ref={tokenRef}
      style={getTokenStyle(tokenType)}
      className={isExplainable ? "cursor-pointer hover:underline decoration-accent decoration-dotted underline-offset-2" : ""}
      onMouseEnter={isExplainable ? onMouseEnterHandler : undefined}
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
    if (isShiftPressed) {
      return lineExplanation || `Shift + 마우스를 올려 "${token}"(이)가 포함된 라인 설명을 가져오는 중...`;
    }
    return explanation || `"${token}" 설명을 보려면 마우스를 올리세요.`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        {isTooltipOpen && ( // Only render content if tooltip is open
          <TooltipContent side="top" align="start" className="max-w-md bg-popover text-popover-foreground p-3 rounded-md border shadow-xl text-sm">
            {tooltipText()}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
