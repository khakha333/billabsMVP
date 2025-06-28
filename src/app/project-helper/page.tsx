
"use client";

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FolderKanban, Wand2, GitBranch, FileUp, FolderTree, Package, BarChart3, Share2, ArrowDownToLine, ArrowUpFromLine, GitCompareArrows, LoaderCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { analyzeGithubRepositoryAction, analyzeDependenciesAction, summarizeProjectAction, modifyCodeAction } from '@/lib/actions';
import type { AnalyzeDependenciesOutput } from '@/ai/flows/analyze-dependencies-flow';
import type { SummarizeProjectOutput } from '@/ai/flows/summarize-project-flow';
import { FileTreeDisplay } from '@/components/FileTreeDisplay';
import { CodeDisplay } from '@/components/CodeDisplay';
import { ChatProvider } from '@/contexts/ChatContext';
import { ProjectVisualization } from '@/components/ProjectVisualization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DependencyGraph } from '@/components/DependencyGraph';
import { parseDependencies, type DependencyGraphData } from '@/lib/dependency-parser';
import { ProjectSummaryDisplay } from '@/components/ProjectSummaryDisplay';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CodeDiffViewer } from '@/components/CodeDiffViewer';


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
  const [impactFile, setImpactFile] = useState<string>('');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const [projectSummary, setProjectSummary] = useState<SummarizeProjectOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [combinedCode, setCombinedCode] = useState<string | null>(null);

  const [isModifying, setIsModifying] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [modificationPrompt, setModificationPrompt] = useState('');
  const [modifiedResult, setModifiedResult] = useState<{ code: string; explanation: string } | null>(null);


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
  
  const processAndSetInput = (content: string, source: string) => {
      setCombinedCode(content); // Store for summary
      const parsedMap = parseProjectInput(content);
      setFileMap(parsedMap);
      handleNodeHighlight(null);
      setDependencyAnalysis(null);
      
      const graphData = parseDependencies(parsedMap);
      setDependencyGraphData(graphData);
      
      toast({
          title: "로드 성공",
          description: `${source}에서 코드를 불러왔습니다. 파일 구조와 의존성 그래프가 생성되었습니다.`,
      });

      runProjectSummary(content); // Run AI Summary

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
      toast({
        title: "프로젝트 요약 실패",
        description: "프로젝트 개요를 생성하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setProjectSummary(null);
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
        toast({
            title: "의존성 분석 실패",
            description: "의존성 정보를 분석하는 중 오류가 발생했습니다.",
            variant: "destructive",
        });
        setDependencyAnalysis(null);
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
    setFileMap(null);
    setDependencyGraphData(null);
    handleNodeHighlight(null);
    setDependencyAnalysis(null);
    setProjectSummary(null);
    setCombinedCode(null);
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
    setFileMap(null);
    handleNodeHighlight(null);
    setDependencyAnalysis(null);
    setDependencyGraphData(null);
    setProjectSummary(null);
    setCombinedCode(null);

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
          } else {
            throw new Error("파일을 ArrayBuffer로 읽지 못했습니다.");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "ZIP 파일을 읽는 중 오류가 발생했습니다.";
          toast({ title: "압축 파일 처리 오류", description: message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
      };
      reader.onerror = () => {
           toast({ title: "파일 로드 오류", description: "파일을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
           setIsLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } else { // Handle single text files
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text === 'string') {
                processAndSetInput(`// FILE: ${file.name}\n// --------------------------------------\n${text}`, `"${file.name}"`);
            } else {
                toast({ title: "파일 로드 실패", description: "파일 내용을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
            }
        } catch(error) {
            const message = error instanceof Error ? error.message : "파일 처리 중 오류가 발생했습니다.";
            toast({ title: "오류", description: message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
      };
      reader.onerror = () => {
        toast({ title: "파일 로드 오류", description: "파일을 읽는 중 오류가 발생했습니다.", variant: "destructive" });
        setIsLoading(false);
      };
      reader.readAsText(file);
    }

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleNodeHighlight = (nodeId: string | null) => {
      setHighlightedNode(nodeId);
      setSelectedFile(nodeId);
      setImpactFile(nodeId || '');
      setSelectedSegment(null); // Reset segment when file changes
      setModifiedResult(null); // Discard any pending modifications
  };

  const detailedImpactAnalysis = useMemo(() => {
    if (!dependencyGraphData || !impactFile) return { dependencies: [], dependents: [] };

    // Get all file-level dependencies and dependents first
    const allRelations = dependencyGraphData.edges.reduce(
        (acc, edge) => {
            if (edge.source === impactFile) acc.dependencies.add(edge.target);
            if (edge.target === impactFile) acc.dependents.add(edge.source);
            return acc;
        }, { dependencies: new Set<string>(), dependents: new Set<string>() }
    );
    
    let finalDependents = Array.from(allRelations.dependents);

    // If a specific segment is selected, filter the dependents list
    if (selectedSegment && fileMap) {
        finalDependents = finalDependents.filter(depPath => {
            const content = fileMap.get(depPath);
            // Simple text search. A more advanced version could use regex or AST.
            // This is a good starting point.
            return content && content.includes(selectedSegment);
        });
    }

    return { 
        dependencies: Array.from(allRelations.dependencies), 
        dependents: finalDependents 
    };
  }, [dependencyGraphData, impactFile, selectedSegment, fileMap]);

  const handleRequestModification = async () => {
      if (!modificationPrompt || !selectedFile || !fileMap) return;

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
              prompt: modificationPrompt,
              fileName: selectedFile,
          });

          if (result.modifiedCode !== originalCode) {
              setModifiedResult({ code: result.modifiedCode, explanation: result.explanation });
              toast({ title: "수정 제안 생성 완료", description: "AI가 생성한 코드 변경사항을 확인하세요." });
          } else {
              toast({ title: "변경사항 없음", description: result.explanation || "AI가 코드를 변경하지 않았습니다.", variant: "default" });
          }

      } catch (error) {
          const message = error instanceof Error ? error.message : "코드 수정 중 오류가 발생했습니다.";
          toast({ title: "오류", description: message, variant: "destructive" });
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
      
      // Also update combinedCode
      if (combinedCode) {
          const lines = combinedCode.split('\n');
          const fileStartIndex = lines.findIndex(line => line.startsWith(`// FILE: ${selectedFile}`));
          
          if (fileStartIndex !== -1) {
              // Find the start of the next file to determine the block to replace
              let fileEndIndex = lines.findIndex((line, index) => index > fileStartIndex && line.startsWith('// FILE:'));
              if (fileEndIndex === -1) {
                  fileEndIndex = lines.length;
              }
              
              const newFileContentBlock = `// FILE: ${selectedFile}\n// --------------------------------------\n${modifiedResult.code}`;
              
              const newCombinedCode = [
                  ...lines.slice(0, fileStartIndex),
                  ...newFileContentBlock.split('\n'),
                  ...lines.slice(fileEndIndex)
              ].join('\n');

              setCombinedCode(newCombinedCode);
          }
      }

      setModifiedResult(null);
      toast({ title: "변경사항 적용됨", description: `'${selectedFile}' 파일이 업데이트되었습니다.` });
  };

  const handleDiscardChanges = () => {
      setModifiedResult(null);
  };


  return (
    <ChatProvider focusChatInput={() => { /* No-op for now */ }}>
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
          {/* Left Column: Project Input & Overview */}
          <div className="lg:w-1/3 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Wand2 className="h-5 w-5" />
                  프로젝트 정보 입력
                </CardTitle>
                <CardDescription>
                  GitHub 저장소 URL을 입력하거나, 프로젝트 ZIP 또는 개별 파일을 업로드하여 AI 분석을 시작하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <label htmlFor="github-url" className="text-sm font-medium">GitHub 저장소 URL</label>
                      <div className="flex items-center gap-2">
                          <Input
                          id="github-url"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          placeholder="https://github.com/owner/repo"
                          className="h-10"
                          disabled={isLoading}
                          />
                          <Button onClick={handleFetchFromRepo} disabled={isLoading || !githubUrl.trim()} className="shrink-0">
                              <GitBranch className="mr-2 h-4 w-4" />
                              {isLoading ? '분석 중...' : '가져오기'}
                          </Button>
                      </div>
                  </div>
                  <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                          또는
                          </span>
                      </div>
                  </div>
                  <div>
                      <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".zip,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.swift,.kt,.kts,.html,.css,.json,.md,.txt" 
                          className="hidden"
                      />
                      <Button onClick={handleUploadButtonClick} variant="outline" className="w-full" disabled={isLoading}>
                          <FileUp className="mr-2 h-5 w-5" />
                          파일 업로드 (.zip 포함)
                      </Button>
                  </div>
              </CardContent>
            </Card>

            {(isSummarizing || projectSummary) && (
              <ProjectSummaryDisplay summary={projectSummary} isLoading={isSummarizing} />
            )}

            {fileMap && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Wand2 className="h-5 w-5" />
                            프로젝트 개요
                        </CardTitle>
                        <CardDescription>
                            AI가 분석한 프로젝트 의존성 및 코드 구조입니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                의존성 분석
                            </h3>
                            {isAnalyzingDependencies ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : dependencyAnalysis && Object.keys(groupedDependencies).length > 0 ? (
                                <Accordion type="single" collapsible className="w-full">
                                    {Object.entries(groupedDependencies).map(([category, deps]) => (
                                        <AccordionItem value={category} key={category}>
                                            <AccordionTrigger>{category} ({deps.length})</AccordionTrigger>
                                            <AccordionContent>
                                                <ul className="space-y-2 text-sm">
                                                    {deps.map(dep => (
                                                        <li key={dep.name}>
                                                            <strong className="font-medium">{dep.name}</strong>: {dep.description}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            ) : (
                                <p className="text-sm text-muted-foreground">분석할 의존성이 없거나, package.json 파일을 찾을 수 없습니다.</p>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" />
                                코드 언어 분포
                            </h3>
                            <div className="h-60 w-full">
                                <ProjectVisualization fileMap={fileMap} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
          </div>

          {/* Right Column: File Tree and Code Viewer */}
          <div className="lg:w-2/3 flex flex-col gap-6">
             <Tabs defaultValue="explorer" className="w-full flex-grow flex flex-col">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="explorer" className="flex-1">
                  <FolderTree className="h-5 w-5 mr-2" />
                  파일 탐색기
                </TabsTrigger>
                <TabsTrigger value="graph" className="flex-1" disabled={!dependencyGraphData}>
                   <Share2 className="h-5 w-5 mr-2" />
                   의존성 그래프
                </TabsTrigger>
                <TabsTrigger value="impact" className="flex-1" disabled={!dependencyGraphData}>
                   <GitCompareArrows className="h-5 w-5 mr-2" />
                   영향 분석
                </TabsTrigger>
              </TabsList>
              <TabsContent value="explorer" className="flex-grow mt-4 flex flex-col gap-6">
                  <Card className="flex-grow flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <FolderTree className="h-5 w-5" />
                        프로젝트 구조
                      </CardTitle>
                      <CardDescription>
                        로드된 프로젝트의 파일 구조입니다. 파일을 클릭하여 내용을 확인하세요.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <ScrollArea className="h-full min-h-[200px] max-h-[300px] p-1 border rounded-md bg-muted/30">
                        {isLoading && (
                          <div className="p-4 text-center text-muted-foreground animate-pulse">
                            <p>파일 구조를 생성하는 중입니다...</p>
                          </div>
                        )}
                        {!isLoading && fileTreeObject && (
                          <FileTreeDisplay
                            tree={fileTreeObject}
                            selectedFile={selectedFile}
                            onFileSelect={handleNodeHighlight}
                          />
                        )}
                        {!isLoading && !fileTreeObject && (
                          <div className="p-4 text-center text-muted-foreground h-full flex flex-col justify-center items-center">
                            <FolderKanban className="h-12 w-12 mb-4 opacity-50" />
                            <p>왼쪽에서 GitHub 저장소나 파일을 로드하세요.</p>
                            <p className="text-xs mt-2">파일 구조가 여기에 표시됩니다.</p>
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <div className="min-h-[400px]">
                     {isModifying ? (
                        <Card className="h-full flex items-center justify-center min-h-[400px]">
                          <div className="text-center text-muted-foreground p-8">
                            <LoaderCircle className="h-16 w-16 mb-4 opacity-50 mx-auto animate-spin" />
                            <p className="text-lg">AI가 코드를 수정하고 있습니다...</p>
                            <p className="text-sm">잠시만 기다려주세요.</p>
                          </div>
                        </Card>
                      ) : modifiedResult ? (
                        <div className="flex flex-col gap-4">
                          <CodeDiffViewer 
                            originalCode={fileMap?.get(selectedFile || '') || ''}
                            modifiedCode={modifiedResult.code}
                            fileName={selectedFile || ''}
                          />
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Wand2 className="h-5 w-5 text-primary" />
                                AI 설명
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{modifiedResult.explanation}</p>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleDiscardChanges}>취소</Button>
                                <Button onClick={handleApplyChanges}>변경사항 적용</Button>
                            </CardFooter>
                          </Card>
                        </div>
                      ) : selectedFile && fileMap ? (
                        <>
                          <CodeDisplay 
                            code={fileMap.get(selectedFile) || ''}
                            fileName={selectedFile}
                            onSegmentSelect={setSelectedSegment}
                          />
                          <div className="flex justify-end mt-4">
                            <Button onClick={() => setShowModifyDialog(true)}>
                                <Wand2 className="mr-2 h-4 w-4" />
                                AI로 코드 수정
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Card className="h-full flex items-center justify-center min-h-[400px]">
                          <div className="text-center text-muted-foreground p-8">
                              <FolderTree className="h-16 w-16 mb-4 opacity-50 mx-auto" />
                              <p className="text-lg">코드 뷰어</p>
                              <p className="text-sm">위 파일 트리에서 파일을 선택하면 여기에 코드가 표시됩니다.</p>
                          </div>
                        </Card>
                      )}
                  </div>
              </TabsContent>
              <TabsContent value="graph" className="flex-grow mt-4">
                {dependencyGraphData ? (
                  <DependencyGraph 
                    graphData={dependencyGraphData} 
                    highlightedNodeId={highlightedNode}
                    onNodeClick={handleNodeHighlight}
                  />
                ) : (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                     <div className="text-center text-muted-foreground p-8">
                      <Share2 className="h-16 w-16 mb-4 opacity-50 mx-auto" />
                      <p className="text-lg">의존성 그래프</p>
                      <p className="text-sm">프로젝트를 로드하면 파일 간의 import 관계가 여기에 시각화됩니다.</p>
                     </div>
                  </Card>
                )}
              </TabsContent>
              <TabsContent value="impact" className="flex-grow mt-4 flex flex-col">
                <div className="flex flex-col gap-6 h-full">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GitCompareArrows className="h-5 w-5 text-primary" />
                                영향 분석
                            </CardTitle>
                            <CardDescription>
                              파일을 선택하여 코드를 확인하고, 코드의 특정 부분을 선택하여 그래프에서 구체적인 영향을 분석하세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select onValueChange={handleNodeHighlight} value={impactFile || ''} disabled={!fileMap}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="분석할 파일을 선택하세요..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {fileMap && Array.from(fileMap.keys()).sort().map(path => (
                                        <SelectItem key={path} value={path}>{path}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {impactFile && fileMap ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
                          <div className="flex flex-col gap-4">
                              <div className="flex-grow min-h-[400px]">
                                  <CodeDisplay 
                                      code={fileMap.get(impactFile) || ''}
                                      fileName={impactFile}
                                      onSegmentSelect={setSelectedSegment}
                                  />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader>
                                      <CardTitle className="text-lg flex items-center gap-2">
                                      <ArrowDownToLine className="h-5 w-5 text-primary" />
                                      의존성 ({detailedImpactAnalysis.dependencies.length})
                                      </CardTitle>
                                      <CardDescription>이 파일이 가져오는 파일</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                      <ScrollArea className="h-32">
                                          <ul className="space-y-1 text-sm">
                                          {detailedImpactAnalysis.dependencies.length > 0 ? (
                                              detailedImpactAnalysis.dependencies.map(dep => <li key={dep} className='p-1 rounded hover:bg-muted'>{dep}</li>)
                                          ) : (
                                              <li className="text-muted-foreground italic">의존성이 없습니다.</li>
                                          )}
                                          </ul>
                                      </ScrollArea>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader>
                                      <CardTitle className="text-lg flex items-center gap-2">
                                        <ArrowUpFromLine className="h-5 w-5 text-primary" />
                                        영향받는 파일 ({detailedImpactAnalysis.dependents.length})
                                      </CardTitle>
                                      <CardDescription>이 파일을 가져오는 파일</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                      <ScrollArea className="h-32">
                                          <ul className="space-y-1 text-sm">
                                          {detailedImpactAnalysis.dependents.length > 0 ? (
                                              detailedImpactAnalysis.dependents.map(dep => <li key={dep} className='p-1 rounded hover:bg-muted'>{dep}</li>)
                                          ) : (
                                              <li className="text-muted-foreground italic">이 파일을 사용하는 파일이 없습니다.</li>
                                          )}
                                          </ul>
                                      </ScrollArea>
                                  </CardContent>
                                </Card>
                              </div>
                          </div>
                          <div className="min-h-[600px]">
                            {dependencyGraphData && (
                                <DependencyGraph 
                                  graphData={dependencyGraphData} 
                                  highlightedNodeId={impactFile}
                                  onNodeClick={handleNodeHighlight}
                                  highlightedNeighbors={new Set([...detailedImpactAnalysis.dependencies, ...detailedImpactAnalysis.dependents])}
                                />
                            )}
                          </div>
                        </div>
                    ) : (
                      <Card className="flex-grow flex items-center justify-center min-h-[400px]">
                        <div className="text-center text-muted-foreground p-8">
                            <GitCompareArrows className="h-16 w-16 mb-4 opacity-50 mx-auto" />
                            <p className="text-lg">파일을 선택하여 영향 분석 시작</p>
                            <p className="text-sm">위 드롭다운에서 파일을 선택하면 코드와 의존성 정보가 여기에 표시됩니다.</p>
                        </div>
                      </Card>
                    )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <footer className="py-4 text-center text-sm text-muted-foreground border-t">
          코드 인사이트 &copy; {new Date().getFullYear()}
        </footer>
        <Dialog open={showModifyDialog} onOpenChange={setShowModifyDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>AI로 코드 수정하기</DialogTitle>
                    <DialogDescription>
                        '{selectedFile || '선택된 파일'}'에 적용할 수정사항을 AI에게 요청하세요. (예: "모든 함수에 JSDoc 주석 추가")
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="수정 요청사항을 입력하세요..."
                        value={modificationPrompt}
                        onChange={(e) => setModificationPrompt(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowModifyDialog(false)}>취소</Button>
                    <Button onClick={handleRequestModification} disabled={!modificationPrompt.trim() || isModifying}>수정 요청</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </ChatProvider>
  );
}
