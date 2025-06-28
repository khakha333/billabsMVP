
"use client";

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FolderKanban, Wand2, GitBranch, FileUp, FolderTree, Package, BarChart3, Share2, GitCompareArrows, LoaderCircle, BotMessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { analyzeGithubRepositoryAction, analyzeDependenciesAction, summarizeProjectAction, modifyCodeAction, reviewCodeAction } from '@/lib/actions';
import type { AnalyzeDependenciesOutput } from '@/ai/flows/analyze-dependencies-flow';
import type { ReviewCodeOutput } from '@/ai/flows/review-code-flow';
import type { SummarizeProjectOutput } from '@/ai/flows/summarize-project-flow';
import { FileTreeDisplay } from '@/components/FileTreeDisplay';
import { CodeDisplay } from '@/components/CodeDisplay';
import { ProjectVisualization } from '@/components/ProjectVisualization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DependencyGraph } from '@/components/DependencyGraph';
import { parseDependencies, type DependencyGraphData } from '@/lib/dependency-parser';
import { ProjectSummaryDisplay } from '@/components/ProjectSummaryDisplay';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CodeDiffViewer } from '@/components/CodeDiffViewer';
import { CodeReviewDisplay } from '@/components/CodeReviewDisplay';


interface TreeNode {
  [key: string]: TreeNode | null;
}

export default function ProjectHelperPage() {
  const [githubUrl, setGithubUrl] = useState('');
  const [fileMap, setFileMap] = useState<Map<string, string> | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dependencyAnalysis, setDependencyAnalysis] = useState<AnalyzeDependenciesOutput['dependencies'] | null>(null);
  const [isAnalyzingDependencies, setIsAnalyzingDependencies] = useState(false);
  const [dependencyGraphData, setDependencyGraphData] = useState<DependencyGraphData | null>(null);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  const [projectSummary, setProjectSummary] = useState<SummarizeProjectOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [combinedCode, setCombinedCode] = useState<string | null>(null);

  const [isModifying, setIsModifying] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [modificationPrompt, setModificationPrompt] = useState('');
  const [modifiedResult, setModifiedResult] = useState<{ code: string; explanation: string } | null>(null);
  
  const [reviewResult, setReviewResult] = useState<ReviewCodeOutput | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.title = '프로젝트 도우미 - 코드 인사이트';
    }
  }, []);

  const parseProjectInput = (fullCode: string): Map<string, string> => {
    const files = new Map<string, string>();
    const fileRegex = /\/\/ FILE: (.*?)\n\/\/ --------------------------------------\n([\s\S]*?)(?=\n\/\/ FILE:|\n\n$)/g;
    let match;
    while ((match = fileRegex.exec(fullCode)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2].trim();
        files.set(filePath, fileContent);
    }
    return files;
  };
  
  const buildFileTreeObject = (paths: string[]): TreeNode => {
    const root: TreeNode = {};
    paths.forEach(path => {
      let currentLevel = root;
      const parts = path.split('/');
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = (index === parts.length - 1) ? null : {};
        }
        currentLevel = currentLevel[part]!;
      });
    });
    return root;
  };

  const fileTreeObject = useMemo(() => {
    if (!fileMap) return null;
    return buildFileTreeObject(Array.from(fileMap.keys()));
  }, [fileMap]);
  
  const resetProjectState = () => {
    setFileMap(null);
    setSelectedFile(null);
    setDependencyAnalysis(null);
    setDependencyGraphData(null);
    setProjectSummary(null);
    setCombinedCode(null);
    setModifiedResult(null);
    setReviewResult(null);
  }

  const processAndSetInput = (content: string, source: string) => {
      resetProjectState();
      setCombinedCode(content); 
      const parsedMap = parseProjectInput(content);
      setFileMap(parsedMap);
      
      const graphData = parseDependencies(parsedMap);
      setDependencyGraphData(graphData);
      
      toast({
          title: "로드 성공",
          description: `${source}에서 코드를 불러왔습니다. 파일 구조와 의존성 그래프가 생성되었습니다.`,
      });

      runProjectSummary(content);

      const packageJsonContent = parsedMap.get('package.json');
      if (packageJsonContent) {
          runDependencyAnalysis(packageJsonContent);
      }
  };

  const runProjectSummary = async (code: string) => {
    setIsSummarizing(true);
    setProjectSummary(null);
    try {
      const result = await summarizeProjectAction({ combinedCode: code });
      setProjectSummary(result);
    } catch (error) {
      console.error("Project summary error:", error);
      toast({ title: "프로젝트 요약 실패", description: "개요 생성 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsSummarizing(false);
    }
  };

  const runDependencyAnalysis = async (packageJsonContent: string) => {
    setIsAnalyzingDependencies(true);
    try {
        const result = await analyzeDependenciesAction({ packageJsonContent });
        setDependencyAnalysis(result.dependencies);
    } catch (error) {
        console.error("Dependency analysis error:", error);
        toast({ title: "의존성 분석 실패", description: "의존성 분석 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
        setIsAnalyzingDependencies(false);
    }
  };

  const groupedDependencies = useMemo(() => {
    if (!dependencyAnalysis) return {};
    return dependencyAnalysis.reduce((acc, dep) => {
      const category = dep.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(dep);
      return acc;
    }, {} as Record<string, typeof dependencyAnalysis>);
  }, [dependencyAnalysis]);

  const handleFetchFromRepo = async () => {
    if (!githubUrl.trim()) return;
    setIsLoading(true);
    resetProjectState();
    try {
      const result = await analyzeGithubRepositoryAction({ repositoryUrl: githubUrl });
      if (result.error) {
        toast({ title: "저장소 분석 실패", description: result.error, variant: "destructive" });
      } else if (result.combinedCode) {
        processAndSetInput(result.combinedCode, `저장소 (${result.fileCount}개 파일)`);
      } else {
        toast({ title: "정보 없음", description: "저장소에서 분석할 수 있는 텍스트 파일을 찾지 못했습니다.", variant: "destructive" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "코드를 가져오는 중 예상치 못한 오류가 발생했습니다.";
      toast({ title: "오류", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    resetProjectState();

    const processTextContent = (text: string, fileName: string) => {
        const allCode = `// FILE: ${fileName}\n// --------------------------------------\n${text}`;
        processAndSetInput(allCode, `"${fileName}"`);
    };

    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result;
          if (content instanceof ArrayBuffer) {
            const zip = await JSZip.loadAsync(content);
            let allCode = `// ${file.name} 압축 파일에서 추출된 코드\n// ======================================\n\n`;
            const filePromises: Promise<void>[] = [];
            
            const textFileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.kts', '.html', '.css', '.json', '.md', '.txt', 'Dockerfile', '.yml', '.yaml', '.sh', '.gitignore', '.npmrc', '.env.example'];
            const textFileNames = ['LICENSE', 'README'];

            zip.forEach((relativePath, zipEntry) => {
                const isTextFile = !zipEntry.dir && (
                    textFileNames.some(name => zipEntry.name.toLowerCase().endsWith(name.toLowerCase())) ||
                    textFileExtensions.some(ext => zipEntry.name.endsWith(ext)) ||
                    zipEntry.name.toLowerCase().endsWith('package.json')
                );
              if (isTextFile) {
                  const filePromise = zipEntry.async('string').then(fileContent => {
                      allCode += `// FILE: ${zipEntry.name}\n// --------------------------------------\n${fileContent}\n\n`;
                  });
                  filePromises.push(filePromise);
              }
            });

            await Promise.all(filePromises);
            processAndSetInput(allCode, `"${file.name}"`);
          } else { throw new Error("파일을 ArrayBuffer로 읽지 못했습니다."); }
        } catch (error) {
          toast({ title: "압축 파일 처리 오류", description: error instanceof Error ? error.message : "ZIP 파일 처리 중 오류 발생", variant: "destructive" });
        } finally { setIsLoading(false); }
      };
      reader.readAsArrayBuffer(file);
    } else { // Handle single text files
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            processTextContent(text, file.name);
          } catch (error) {
            toast({ title: "파일 처리 오류", description: error instanceof Error ? error.message : "파일 처리 중 오류 발생", variant: "destructive" });
          } finally { setIsLoading(false); }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const handleUploadButtonClick = () => fileInputRef.current?.click();
  
  const handleNodeHighlight = (nodeId: string | null) => {
      setHighlightedNode(nodeId);
      setSelectedFile(nodeId);
      setModifiedResult(null);
      setReviewResult(null);
  };
  
  const handleRequestModification = async (prefilledPrompt?: string) => {
      const promptToUse = prefilledPrompt || modificationPrompt;
      if (!promptToUse || !selectedFile || !fileMap) return;

      setShowModifyDialog(false);
      setIsModifying(true);
      setModifiedResult(null);

      const originalCode = fileMap.get(selectedFile);
      if (!originalCode) {
          toast({ title: "오류", description: "원본 코드를 찾을 수 없습니다.", variant: "destructive" });
          setIsModifying(false);
          return;
      }

      try {
          const result = await modifyCodeAction({
              code: originalCode,
              prompt: promptToUse,
              fileName: selectedFile,
          });

          if (result.modifiedCode !== originalCode) {
              setModifiedResult({ code: result.modifiedCode, explanation: result.explanation });
              toast({ title: "수정 제안 생성 완료", description: "AI가 생성한 코드 변경사항을 확인하세요." });
          } else {
              toast({ title: "변경사항 없음", description: result.explanation || "AI가 코드를 변경하지 않았습니다." });
          }
      } catch (error) {
          toast({ title: "오류", description: error instanceof Error ? error.message : "코드 수정 중 오류 발생", variant: "destructive" });
      } finally {
          setIsModifying(false);
          setModificationPrompt('');
      }
  };

  const handleApplyChanges = () => {
      if (!modifiedResult || !selectedFile || !fileMap) return;
      const newFileMap = new Map(fileMap);
      newFileMap.set(selectedFile, modifiedResult.code);
      setFileMap(newFileMap);
      setModifiedResult(null);
      toast({ title: "변경사항 적용됨", description: `'${selectedFile}' 파일이 업데이트되었습니다.` });
  };

  const handleDiscardChanges = () => setModifiedResult(null);
  
  const handleReviewFile = async () => {
    if (!selectedFile || !fileMap) {
      toast({ title: "파일 선택 필요", description: "먼저 파일 탐색기에서 검토할 파일을 선택하세요.", variant: "destructive" });
      return;
    }
    setIsReviewing(true);
    setReviewResult(null);
    try {
      const code = fileMap.get(selectedFile)!;
      const result = await reviewCodeAction({ code, fileName: selectedFile });
      setReviewResult(result);
    } catch(error) {
      toast({ title: "리뷰 오류", description: error instanceof Error ? error.message : "코드 검토 중 오류 발생", variant: "destructive" });
    } finally {
      setIsReviewing(false);
    }
  };


  return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="py-4 px-6 border-b border-border shadow-sm bg-card sticky top-0 z-10">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">
                프로젝트 도우미
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
          <div className="lg:w-1/3 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Wand2 className="h-5 w-5" />
                  프로젝트 정보 입력
                </CardTitle>
                <CardDescription>
                  GitHub URL, 프로젝트 ZIP, 또는 개별 파일을 업로드하여 AI 분석을 시작하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <label htmlFor="github-url" className="text-sm font-medium">GitHub 저장소 URL</label>
                      <div className="flex items-center gap-2">
                          <Input id="github-url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/owner/repo" disabled={isLoading} />
                          <Button onClick={handleFetchFromRepo} disabled={isLoading || !githubUrl.trim()} className="shrink-0"><GitBranch className="mr-2 h-4 w-4" />{isLoading ? '분석 중...' : '가져오기'}</Button>
                      </div>
                  </div>
                  <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">또는</span></div></div>
                  <div>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".zip,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.swift,.kt,.kts,.html,.css,.json,.md,.txt" className="hidden" />
                      <Button onClick={handleUploadButtonClick} variant="outline" className="w-full" disabled={isLoading}><FileUp className="mr-2 h-5 w-5" />파일 업로드 (.zip 포함)</Button>
                  </div>
              </CardContent>
            </Card>

            {(isSummarizing || projectSummary) && <ProjectSummaryDisplay summary={projectSummary} isLoading={isSummarizing} />}
            {fileMap && (
                <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Wand2 className="h-5 w-5" />프로젝트 개요</CardTitle><CardDescription>AI가 분석한 프로젝트 의존성 및 코드 구조입니다.</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package className="h-5 w-5 text-primary" />의존성 분석</h3>
                            {isAnalyzingDependencies ? <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : dependencyAnalysis && Object.keys(groupedDependencies).length > 0 ? (
                                <Accordion type="single" collapsible className="w-full">
                                    {Object.entries(groupedDependencies).map(([category, deps]) => (
                                        <AccordionItem value={category} key={category}><AccordionTrigger>{category} ({deps.length})</AccordionTrigger><AccordionContent><ul className="space-y-2 text-sm">{deps.map(dep => <li key={dep.name}><strong className="font-medium">{dep.name}</strong>: {dep.description}</li>)}</ul></AccordionContent></AccordionItem>
                                    ))}
                                </Accordion>
                            ) : <p className="text-sm text-muted-foreground">분석할 의존성이 없거나, package.json 파일을 찾을 수 없습니다.</p>}
                        </div>
                        <div><h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />코드 언어 분포</h3><div className="h-60 w-full"><ProjectVisualization fileMap={fileMap} /></div></div>
                    </CardContent></Card>
            )}
          </div>

          <div className="lg:w-2/3 flex flex-col gap-6">
             <Tabs defaultValue="explorer" className="w-full flex-grow flex flex-col">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="explorer"><FolderTree className="h-5 w-5 mr-2" />파일 탐색기</TabsTrigger>
                <TabsTrigger value="graph" disabled={!dependencyGraphData}><Share2 className="h-5 w-5 mr-2" />의존성 그래프</TabsTrigger>
                <TabsTrigger value="review" disabled={!fileMap}><BotMessageSquare className="h-5 w-5 mr-2" />AI 코드 검토</TabsTrigger>
              </TabsList>
              <TabsContent value="explorer" className="flex-grow mt-4 flex flex-col gap-6">
                  <Card className="flex-grow flex flex-col">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><FolderTree className="h-5 w-5" />프로젝트 구조</CardTitle><CardDescription>프로젝트 파일을 클릭하여 내용을 확인하고 AI로 수정하세요.</CardDescription></CardHeader>
                    <CardContent className="flex-grow"><ScrollArea className="h-full min-h-[200px] max-h-[300px] p-1 border rounded-md bg-muted/30">{isLoading ? <div className="p-4 text-center text-muted-foreground animate-pulse"><p>파일 구조 생성 중...</p></div> : fileTreeObject ? <FileTreeDisplay tree={fileTreeObject} selectedFile={selectedFile} onFileSelect={handleNodeHighlight} /> : <div className="p-4 text-center text-muted-foreground h-full flex flex-col justify-center items-center"><FolderKanban className="h-12 w-12 mb-4 opacity-50" /><p>왼쪽에서 프로젝트를 로드하세요.</p></div>}</ScrollArea></CardContent>
                  </Card>
                  <div className="min-h-[400px]">
                     {isModifying ? <Card className="h-full flex items-center justify-center min-h-[400px]"><div className="text-center text-muted-foreground p-8"><LoaderCircle className="h-16 w-16 mb-4 opacity-50 mx-auto animate-spin" /><p className="text-lg">AI가 코드를 수정하고 있습니다...</p></div></Card>
                      : modifiedResult ? (
                        <div className="flex flex-col gap-4">
                          <CodeDiffViewer originalCode={fileMap?.get(selectedFile || '') || ''} modifiedCode={modifiedResult.code} fileName={selectedFile || ''} />
                          <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />AI 설명</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{modifiedResult.explanation}</p></CardContent><CardFooter className="flex justify-end gap-2"><Button variant="outline" onClick={handleDiscardChanges}>취소</Button><Button onClick={handleApplyChanges}>변경사항 적용</Button></CardFooter></Card>
                        </div>
                      ) : selectedFile && fileMap ? (
                        <><CodeDisplay code={fileMap.get(selectedFile) || ''} fileName={selectedFile} /><div className="flex justify-end mt-4"><Button onClick={() => setShowModifyDialog(true)}><Wand2 className="mr-2 h-4 w-4" />AI로 코드 수정</Button></div></>
                      ) : <Card className="h-full flex items-center justify-center min-h-[400px]"><div className="text-center text-muted-foreground p-8"><FolderTree className="h-16 w-16 mb-4 opacity-50 mx-auto" /><p className="text-lg">파일을 선택하면 코드가 표시됩니다.</p></div></Card>}
                  </div>
              </TabsContent>
              <TabsContent value="graph" className="flex-grow mt-4"><DependencyGraph graphData={dependencyGraphData} highlightedNodeId={highlightedNode} onNodeClick={handleNodeHighlight} /></TabsContent>
              <TabsContent value="review" className="flex-grow mt-4">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BotMessageSquare className="h-5 w-5 text-primary" />
                            AI 코드 검토
                        </CardTitle>
                        <CardDescription>
                            AI 에이전트가 코드의 문제점을 찾고 수정을 제안합니다. 먼저 검토할 파일을 선택한 후, 'AI로 검토 실행' 버튼을 누르세요.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 flex-grow">
                        <Button onClick={handleReviewFile} disabled={isReviewing || !selectedFile}>
                            {isReviewing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            {isReviewing ? '검토 중...' : selectedFile ? `'${selectedFile.split('/').pop()}' 파일 검토 실행` : '파일을 먼저 선택하세요'}
                        </Button>
                        <div className="flex-grow">
                            <CodeReviewDisplay
                                reviewResult={reviewResult}
                                isLoading={isReviewing}
                                onSuggestionFix={(suggestion) => handleRequestModification(`다음 코드 리뷰 제안에 따라 코드를 수정해 주세요: [${suggestion.severity}] ${suggestion.title} - ${suggestion.suggestion}`)}
                            />
                        </div>
                    </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <footer className="py-4 text-center text-sm text-muted-foreground border-t">코드 인사이트 &copy; {new Date().getFullYear()}</footer>
        <Dialog open={showModifyDialog} onOpenChange={setShowModifyDialog}>
            <DialogContent>
                <DialogHeader><DialogTitle>AI로 코드 수정하기</DialogTitle><DialogDescription>'{selectedFile || '선택된 파일'}'에 적용할 수정사항을 AI에게 요청하세요. (예: "모든 함수에 JSDoc 주석 추가")</DialogDescription></DialogHeader>
                <div className="py-4"><Textarea placeholder="수정 요청사항을 입력하세요..." value={modificationPrompt} onChange={(e) => setModificationPrompt(e.target.value)} className="min-h-[100px]" /></div>
                <DialogFooter><Button variant="ghost" onClick={() => setShowModifyDialog(false)}>취소</Button><Button onClick={() => handleRequestModification()} disabled={!modificationPrompt.trim() || isModifying}>수정 요청</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
  );
}
