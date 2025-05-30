"use client";

import type React from 'react';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { explainCodeSegmentAction } from '@/lib/actions'; // Server action
import type { ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';

interface CodeTokenProps {
  token: string;
  fullCodeContext: string;
}

// Extended keyword list
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

const getTokenType = (token: string, nextToken?: string): string => {
  if (KEYWORDS.has(token)) {
    return 'keyword';
  }
  if (OPERATORS_PUNCTUATION.has(token)) {
    if (['(', ')', '{', '}', '[', ']'].includes(token)) return 'punctuation-bracket';
    if (['.', ',', ';', ':'].includes(token)) return 'punctuation-separator';
    return 'operator';
  }
  if (token.startsWith('//') || token.startsWith('/*') || token.startsWith('*') && token.endsWith('*/')) {
    return 'comment';
  }
  if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"')) || (token.startsWith('`') && token.endsWith('`'))) {
    return 'string';
  }
  if (!isNaN(parseFloat(token)) && isFinite(token as any)) {
    return 'number';
  }
  if (token.match(/^[A-Z_][A-Z0-9_]*$/) && token.length > 1) { // All caps convention for constants
    return 'constant-convention';
  }
  // Basic function name detection (very heuristic)
  if (nextToken === '(' && token.match(/^[a-zA-Z_]\w*$/)) {
     return 'function-name';
  }
  if (token.match(/^[a-zA-Z_]\w*$/)) { // Potential variable/identifier
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
    case 'constant-convention': return { color: 'var(--code-number-color)', fontWeight: '500' }; // Re-use number color for some constants
    default: return { color: 'var(--code-default-color)' };
  }
};


export const CodeToken: React.FC<CodeTokenProps> = ({ token, fullCodeContext }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  // Determine token type for styling (simplified for example)
  // In a real scenario, this would be part of a more robust parsing step
  const tokenType = getTokenType(token, ''); // nextToken not easily available here, can improve

  const handleFetchExplanation = async () => {
    if (!explanation && !isLoading && token.trim().length > 0 && tokenType !== 'comment' && tokenType !== 'string' && !OPERATORS_PUNCTUATION.has(token) && !KEYWORDS.has(token)) {
      setIsLoading(true);
      try {
        const result: ExplainCodeSegmentOutput = await explainCodeSegmentAction({ code: fullCodeContext, codeSegment: token });
        setExplanation(result.explanation);
      } catch (error) {
        console.error("Error fetching explanation:", error);
        setExplanation("이 토큰에 대한 설명을 가져올 수 없습니다.");
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // Don't make operators, punctuation, comments, strings, or keywords hoverable for explanation by default
  const isExplainable = token.trim().length > 0 && 
                        !OPERATORS_PUNCTUATION.has(token) && 
                        !KEYWORDS.has(token) &&
                        tokenType !== 'comment' &&
                        tokenType !== 'string' &&
                        tokenType !== 'number';


  if (token === '\n') {
    return <br />;
  }
  if (token.trim() === '' && token !== '\n') { // Preserve multiple spaces if they are actual tokens
    return <span style={{whiteSpace: 'pre'}}>{token}</span>;
  }


  const content = (
    <span
      style={getTokenStyle(tokenType)}
      className={isExplainable ? "cursor-pointer hover:underline decoration-accent decoration-dotted underline-offset-2" : ""}
      onMouseEnter={isExplainable ? handleFetchExplanation : undefined}
    >
      {token}
    </span>
  );

  if (!isExplainable) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        {isTooltipOpen && (
          <TooltipContent side="top" align="start" className="max-w-md bg-popover text-popover-foreground p-3 rounded-md border shadow-xl text-sm">
            {isLoading ? (
              <div className="space-y-1.5 p-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              explanation || `"${token}" 설명을 보려면 마우스를 올리세요.`
            )}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
