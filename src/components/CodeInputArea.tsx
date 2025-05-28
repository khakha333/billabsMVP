"use client";

import type React from 'react';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, UploadCloud } from 'lucide-react';

interface CodeInputAreaProps {
  onAnalyze: (code: string) => void;
  isLoading: boolean;
}

export const CodeInputArea: React.FC<CodeInputAreaProps> = ({ onAnalyze, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAnalyze(inputValue);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UploadCloud className="h-6 w-6 text-primary" />
          Input Your Code
        </CardTitle>
        <CardDescription>
          Paste your code snippet below to get an AI-powered analysis and explanation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Paste your code here..."
          className="h-full w-full resize-none font-mono text-sm p-3 rounded-md shadow-inner"
          aria-label="Code input area"
        />
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={isLoading || !inputValue.trim()} className="w-full text-base py-3">
          <Wand2 className="mr-2 h-5 w-5" />
          {isLoading ? 'Analyzing...' : 'Analyze Code'}
        </Button>
      </CardFooter>
    </Card>
  );
};
