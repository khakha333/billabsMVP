"use client";

import { useState } from 'react';
import type React from 'react';
import { Header } from '@/components/layout/Header';
import { CodeInputArea } from '@/components/CodeInputArea';
import { AnalysisSummaryDisplay } from '@/components/AnalysisSummaryDisplay';
import { CodeDisplay } from '@/components/CodeDisplay';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCodeStructureAction } from '@/lib/actions';
import type { SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';

export default function CodeInsightsPage() {
  const [inputCode, setInputCode] = useState<string>('');
  const [displayedCode, setDisplayedCode] = useState<string>(''); // Code to show in CodeDisplay
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const { toast } = useToast();

  const handleAnalyzeCode = async (codeInput: string) => {
    setIsLoadingAnalysis(true);
    setSummary(null); // Clear previous summary
    setInputCode(codeInput); // Store original input for analysis & export
    setDisplayedCode(codeInput); // Set code for display

    try {
      const result: SummarizeCodeStructureOutput = await analyzeCodeStructureAction({ code: codeInput });
      setSummary(result.summary);
      toast({
        title: "Analysis Complete",
        description: "Code structure summary has been generated.",
      });
    } catch (error) {
      console.error("Analysis error:", error);
      let errorMessage = "Failed to analyze code.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setSummary(`Error: ${errorMessage}`);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleExport = () => {
    if (!inputCode) {
      toast({
        title: "Export Error",
        description: "No code to export. Please analyze some code first.",
        variant: "destructive",
      });
      return;
    }

    const content = `// Code Insights Export
// =====================

// Original Code:
// --------------
${inputCode}

// AI Generated Summary:
// ---------------------
${summary || 'No summary available.'}
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'code_insights_export.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Clean up
    toast({
      title: "Export Successful",
      description: "Code and summary exported to code_insights_export.txt",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-[calc(100vh-200px)]"> {/* Adjust min-h as needed */}
          {/* Left Pane: Code Input & Summary */}
          <div className="lg:w-1/3 flex flex-col gap-6 min-h-[300px] lg:min-h-0">
            <div className="flex-grow h-1/2 lg:h-auto">
              <CodeInputArea onAnalyze={handleAnalyzeCode} isLoading={isLoadingAnalysis} />
            </div>
            <div className="flex-grow h-1/2 lg:h-auto">
              <AnalysisSummaryDisplay summary={summary} isLoading={isLoadingAnalysis} />
            </div>
          </div>

          {/* Right Pane: Code Display */}
          <div className="lg:w-2/3 flex-grow min-h-[400px] lg:min-h-0">
            {displayedCode ? (
              <CodeDisplay code={displayedCode} />
            ) : (
              <div className="h-full flex items-center justify-center bg-card rounded-lg shadow">
                <p className="text-muted-foreground text-lg italic p-8 text-center">
                  Your interactive code view will appear here once you analyze some code.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-auto pt-4 flex justify-end">
          <Button onClick={handleExport} disabled={!inputCode && !summary} variant="outline">
            <Download className="mr-2 h-5 w-5" />
            Export Code & Summary
          </Button>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        Code Insights &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
