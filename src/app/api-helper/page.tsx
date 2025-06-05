
"use client";

import type { Metadata } from 'next';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, ListChecks, Info, Code2, Lightbulb, AlertTriangle, ExternalLink } from 'lucide-react';
import { generateApiExamplesAction } from '@/lib/actions';
import type { GenerateApiExamplesOutput } from '@/ai/flows/generate-api-examples-flow';

// Metadata can be static, so it's outside the component
// export const metadata: Metadata = { // This needs to be handled differently for client components or moved to a layout/server component
//   title: 'API 도우미 - 코드 인사이트',
//   description: '다양한 API의 사용법과 예제를 찾아보세요.',
// };

const famousApis = [
  { name: 'React useState', displayName: 'React useState Hook' },
  { name: 'React useEffect', displayName: 'React useEffect Hook' },
  { name: 'Next.js Link Component', displayName: 'Next.js <Link> Component' },
  { name: 'Next.js Image Component', displayName: 'Next.js <Image> Component' },
  { name: 'Next.js App Router', displayName: 'Next.js App Router (Server Components)' },
  { name: 'JavaScript Array map', displayName: 'JavaScript Array.prototype.map()' },
  { name: 'JavaScript Array filter', displayName: 'JavaScript Array.prototype.filter()' },
  { name: 'JavaScript Fetch API', displayName: 'JavaScript Fetch API' },
  { name: 'localStorage Web API', displayName: 'Browser localStorage API' },
  { name: 'sessionStorage Web API', displayName: 'Browser sessionStorage API' },
  { name: 'Genkit AI Generate function', displayName: 'Genkit AI - Core Generate' },
  { name: 'Genkit AI Define Flow', displayName: 'Genkit AI - Define Flow' },
  { name: 'Tailwind CSS', displayName: 'Tailwind CSS (Utility-first CSS)' },
  { name: 'Shadcn UI Button', displayName: 'Shadcn UI - Button' },
  { name: 'Shadcn UI Card', displayName: 'Shadcn UI - Card' },
  { name: 'Zod Schema Validation', displayName: 'Zod (Schema Validation)' },
  { name: 'Lucide Icons React', displayName: 'Lucide Icons (React)' },
  { name: 'Firebase Authentication', displayName: 'Firebase Authentication (Web)' },
  { name: 'Cloud Firestore', displayName: 'Cloud Firestore (Web SDK)' },
];

export default function ApiHelperPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApiName, setSelectedApiName] = useState<string | null>(null);
  const [selectedApiDisplayName, setSelectedApiDisplayName] = useState<string | null>(null);
  const [apiDetails, setApiDetails] = useState<GenerateApiExamplesOutput | null>(null);
  const [isLoadingApiDetails, setIsLoadingApiDetails] = useState(false);
  const [errorApiDetails, setErrorApiDetails] = useState<string | null>(null);

  useEffect(() => {
    // Set document title dynamically on the client side
    if (typeof window !== 'undefined') {
      document.title = 'API 도우미 - 코드 인사이트';
    }
  }, []);

  const filteredApis = useMemo(() => {
    if (!searchTerm) return famousApis;
    return famousApis.filter(api =>
      api.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  useEffect(() => {
    if (selectedApiName) {
      const fetchApiDetails = async () => {
        setIsLoadingApiDetails(true);
        setErrorApiDetails(null);
        setApiDetails(null);
        try {
          const result = await generateApiExamplesAction({ apiName: selectedApiName });
          if (result.examples.length === 0 && result.generalUsageNotes?.startsWith("오류:")) {
             setErrorApiDetails(result.generalUsageNotes || result.briefDescription);
          } else if (result.briefDescription.toLowerCase().includes("찾을 수 없") || result.briefDescription.toLowerCase().includes("unknown api")) {
             setErrorApiDetails(`죄송합니다. '${selectedApiDisplayName || selectedApiName}'에 대한 정보를 찾을 수 없습니다. 다른 키워드로 시도해 보세요.`);
          }
          else {
            setApiDetails(result);
          }
        } catch (e) {
          console.error("Failed to fetch API examples:", e);
          const errorMessage = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
          setErrorApiDetails(`API 예제를 가져오는데 실패했습니다: ${errorMessage}`);
        } finally {
          setIsLoadingApiDetails(false);
        }
      };
      fetchApiDetails();
    }
  }, [selectedApiName, selectedApiDisplayName]);

  const handleApiSelect = (api: { name: string; displayName: string }) => {
    setSelectedApiName(api.name);
    setSelectedApiDisplayName(api.displayName);
    setSearchTerm(''); // Clear search term after selection
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="py-4 px-6 border-b border-border shadow-sm bg-card sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListChecks className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              API 도우미
            </h1>
          </div>
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-5 w-5" />
              메인으로 돌아가기
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Search and API List */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5" />
                API 검색 및 선택
              </CardTitle>
              <CardDescription>
                학습하고 싶은 API를 검색하거나 목록에서 선택하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="API 이름 검색... (예: React, Next.js, Firebase)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm"
              />
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[200px] lg:h-[calc(100vh-320px)] pr-3 border rounded-md">
                {filteredApis.length > 0 ? (
                  <div className="space-y-1 p-2">
                    {filteredApis.map(api => (
                      <Button
                        key={api.name}
                        variant={selectedApiName === api.name ? "secondary" : "ghost"}
                        className="w-full justify-start text-sm h-auto py-2"
                        onClick={() => handleApiSelect(api)}
                      >
                        {api.displayName}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground text-center">검색 결과가 없습니다.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: API Details */}
        <div className="lg:w-2/3 flex flex-col">
          <Card className="flex-grow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Info className="h-5 w-5" />
                API 상세 정보
              </CardTitle>
              <CardDescription>
                {selectedApiDisplayName 
                  ? `'${selectedApiDisplayName}'에 대한 AI 생성 설명 및 예제입니다.`
                  : "왼쪽 목록에서 API를 선택하면 여기에 정보가 표시됩니다."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full">
              <ScrollArea className="h-[calc(100vh-300px)] min-h-[300px] lg:h-[calc(100vh-250px)] pr-3">
                {isLoadingApiDetails && (
                  <div className="space-y-4 p-1">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="mt-6 space-y-3">
                      <Skeleton className="h-8 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-8 w-1/2 mt-4" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                )}

                {!isLoadingApiDetails && errorApiDetails && (
                  <div className="p-4 text-destructive flex flex-col items-center justify-center text-center h-full">
                    <AlertTriangle className="h-12 w-12 mb-3" />
                    <p className="text-lg font-semibold">오류 발생</p>
                    <p className="text-sm">{errorApiDetails}</p>
                  </div>
                )}

                {!isLoadingApiDetails && !errorApiDetails && apiDetails && (
                  <div className="space-y-6 p-1">
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2">
                        <Lightbulb className="h-5 w-5" />
                        간략한 설명
                      </h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{apiDetails.briefDescription}</p>
                    </div>

                    {apiDetails.examples && apiDetails.examples.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2">
                          <Code2 className="h-5 w-5" />
                          코드 예제
                        </h3>
                        <Accordion type="single" collapsible className="w-full">
                          {apiDetails.examples.map((example, index) => (
                            <AccordionItem value={`example-${index}`} key={index}>
                              <AccordionTrigger className="text-md hover:no-underline">
                                {index + 1}. {example.title}
                              </AccordionTrigger>
                              <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                                <p className="text-xs italic text-muted-foreground mb-2 whitespace-pre-wrap">{example.description}</p>
                                <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
                                  <code className="font-mono">{example.codeSnippet}</code>
                                </pre>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}

                    {apiDetails.generalUsageNotes && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2">
                           <ExternalLink className="h-5 w-5" />
                          일반 사용 참고사항
                        </h3>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{apiDetails.generalUsageNotes}</p>
                      </div>
                    )}
                  </div>
                )}
                {!isLoadingApiDetails && !errorApiDetails && !apiDetails && !selectedApiName && (
                   <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                        <ListChecks className="h-16 w-16 mb-4 opacity-50" />
                        <p className="text-lg">API를 선택해주세요.</p>
                        <p className="text-sm">왼쪽의 목록에서 API를 검색하거나 선택하면 여기에 자세한 정보가 표시됩니다.</p>
                    </div>
                )}
                 {!isLoadingApiDetails && !errorApiDetails && !apiDetails && selectedApiName && (
                   <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                        <Search className="h-16 w-16 mb-4 opacity-50 animate-pulse" />
                        <p className="text-lg">'{selectedApiDisplayName}' 정보를 불러오는 중 문제가 발생했거나, 데이터가 없습니다.</p>
                        <p className="text-sm">잠시 후 다시 시도하거나 다른 API를 선택해 주세요.</p>
                    </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        코드 인사이트 &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
