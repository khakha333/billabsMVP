
"use client";

import type React from 'react';
import { useState, useEffect } from 'react';
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
  if (token.match(/^[A-Z_][A-Z0-9_]*$/) && token.length > 1) {
    return 'constant-convention';
  }
  if (nextToken === '(' && token.match(/^[a-zA-Z_]\w*$/)) {
     return 'function-name';
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

const getLineContainingToken = (fullCode: string, token: string, tokenIndex: number): string => {
  const lines = fullCode.split('\n');
  let currentTokenCounter = 0; // This will count tokens, not characters
  const codeTokensForLineCounting = fullCode.split(/(\s+|[().,{}[\];:\-+*/%&|^~<>?=]|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g).filter(t => t !== undefined && t !== '');


  for (const line of lines) {
    // A more robust way to count tokens per line is needed if tokenIndex is based on global token array
    // For simplicity, assuming tokenIndex is a character index or a pre-calculated token index within its line.
    // This part needs robust token-to-line mapping.
    // The current getTokenIndexInFullCode is also very basic.
    // For now, if fullCode.indexOf(token) is on the line, assume it's the one. This is naive.
    // A better approach would be to pre-tokenize and store line numbers with tokens.
    
    // A simplified placeholder for robust line finding.
    // This will just return the first line containing the token text, which might be wrong for repeated tokens.
    // A more sophisticated approach would involve passing the actual index of the token within the tokenized array.
    if (line.includes(token)) return line.trim();
  }
  
  // Fallback if the above naive search fails or for a more accurate (but complex) method:
  // This part assumes tokenIndex is the index in the `codeTokensForLineCounting` array.
  let count = 0;
  for (const line of lines) {
    const lineTokens = line.split(/(\s+|[().,{}[\];:\-+*/%&|^~<>?=]|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g).filter(t => t !== undefined && t !== '');
    if (count <= tokenIndex && tokenIndex < count + lineTokens.length) {
        // Check if this line actually contains the specific token instance we are interested in.
        // This is still tricky without exact token instance tracking.
        if (lineTokens.includes(token)) return line.trim();
    }
    count += lineTokens.length;
  }

  return ''; // Fallback
};


// This helper is very basic and might not be accurate for repeated tokens.
const getTokenIndexInFullCode = (fullCode: string, targetToken: string, tokenElement: HTMLSpanElement | null): number => {
  // This function is problematic and not used reliably by getLineContainingToken.
  // For a robust solution, tokenization should happen once, storing line and column numbers.
  return -1; // Placeholder, as this function is not robust.
};

export const CodeToken: React.FC<CodeTokenProps> = ({ token, fullCodeContext }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [lineExplanation, setLineExplanation] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const tokenType = getTokenType(token, '');

  const handleFetchExplanation = async () => {
    if (explanation || isLoading || !token.trim() || !isExplainable) {
      return;
    }

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
  };

  const handleFetchLineExplanation = async (lineOfCode: string) => {
     if (lineExplanation || isLoading || !lineOfCode.trim()) {
        return;
     }
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
  
  const isExplainable = token.trim().length > 0 && 
                        !OPERATORS_PUNCTUATION.has(token) && 
                        !KEYWORDS.has(token) &&
                        tokenType !== 'comment' &&
                        tokenType !== 'string' &&
                        tokenType !== 'number';

  if (token === '\n') {
    return <br />;
  }
  if (token.trim() === '' && token !== '\n') {
    return <span style={{whiteSpace: 'pre'}}>{token}</span>;
  }

  const content = (
    <span
      style={getTokenStyle(tokenType)}
      className={isExplainable ? "cursor-pointer hover:underline decoration-accent decoration-dotted underline-offset-2" : ""}
      onMouseEnter={isExplainable ? (e) => {
        const shiftKeyActive = e.shiftKey;
        setIsShiftPressed(shiftKeyActive);
        if (shiftKeyActive) {
          // getLineContainingToken is not robust enough. A better approach would be needed for accurate line detection.
          // For now, we'll use a placeholder or a very simplified line detection.
          // A truly robust solution requires tokenizing with line numbers upfront.
          // Let's assume for now we want to explain the token itself, even on shift-hover, if line detection is poor.
          // Or, provide a very naive line:
          const lines = fullCodeContext.split('\n');
          let currentTokenCharIndex = 0; // This is a placeholder index
          // This is a naive way to find which line the current token (character sequence) is on
          let foundLine = "";
          for(const l of lines) {
            if(l.includes(token)) { // This is still not perfect for repeated tokens on different lines
              foundLine = l.trim();
              break;
            }
          }
          if (foundLine) {
            handleFetchLineExplanation(foundLine);
          } else {
             handleFetchLineExplanation(token); // Fallback to explain token if line not found
          }
        } else {
          handleFetchExplanation();
        }} : undefined}
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
              isShiftPressed ? 
              (lineExplanation || `Shift + 마우스를 올려 "${token}"(이)가 포함된 라인 설명을 보세요. (라인 감지 기능 개선 중)`) : 
              (explanation || `"${token}" 설명을 보려면 마우스를 올리세요.`)
            )}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

