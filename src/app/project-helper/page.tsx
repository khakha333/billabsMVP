
"use client";

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, FolderKanban, Wand2, GitBranch, FileUp, FolderTree, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { analyzeGithubRepositoryAction } from '@/lib/actions';


export default function ProjectHelperPage() {
  const [projectInput, setProjectInput] = useState(''); // Holds the combined code content
  const [githubUrl, setGithubUrl] = useState('');
  const [fileTree, setFileTree] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.title = '프로젝트 도우미 - 코드 인사이트';
    }
  }, []);

  const generateFileTree = (code: string): string => {
    const filePaths = (code.match(/\/\/ FILE: (.*)/g) || []).map(line => line.replace(/\/\/ FILE: /, ''));
    if (filePaths.length === 0) {
      if (code.trim()) return '파일 구조를 파싱할 수 있는 마커(// FILE: ...)가 없습니다.';
      return '분석할 파일이 없습니다.';
    }

    const root: any = {};

    filePaths.forEach(path => {
      let currentLevel = root;
      const parts = path.split('/');
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = (index === parts.length - 1) ? null : {};
        }
        currentLevel = currentLevel[part];
      });
    });
    
    const rootKeys = Object.keys(root);
    let baseNode = root;
    let baseName = '프로젝트 루트';
    
    if (rootKeys.length === 1 && root[rootKeys[0]] !== null) {
        baseName = rootKeys[0];
        baseNode = root[rootKeys[0]];
    }

    const buildTreeString = (node: any, prefix = ''): string => {
        let result = '';
        if (!node) return result;
        const keys = Object.keys(node);
        keys.forEach((key, index) => {
            const isLast = index === keys.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            result += `${prefix}${connector}${key}\n`;
            if (node[key] !== null) { // It's a directory
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                result += buildTreeString(node[key], newPrefix);
            }
        });
        return result;
    };

    return `${baseName}\n${buildTreeString(baseNode)}`;
  };
  
  const processAndSetInput = (content: string, source: string) => {
      setProjectInput(content);
      const tree = generateFileTree(content);
      setFileTree(tree);
      toast({
          title: "로드 성공",
          description: `${source}에서 코드를 불러왔습니다. 파일 구조가 오른쪽에 표시됩니다.`,
      });
  };

  const handleFetchFromRepo = async () => {
    if (!githubUrl.trim()) return;
    setIsLoading(true);
    setFileTree(null);
    setProjectInput('');
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
    setFileTree(null);
    setProjectInput('');

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
                    textFileExtensions.some(ext => zipEntry.name.endsWith(ext))
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

  const handleAnalyzeProject = async () => {
    if (!projectInput.trim()) {
      toast({
        title: "분석할 데이터 없음",
        description: "먼저 GitHub 저장소나 파일을 로드해주세요.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "AI 에이전트 준비",
      description: "프로젝트에 대한 질문을 시작할 수 있습니다. (채팅 기능은 추후 구현됩니다.)",
    });
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
        {/* Left Column: Project Input */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <Card className="flex flex-col flex-grow">
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
            <CardFooter>
              <Button 
                onClick={handleAnalyzeProject} 
                disabled={isLoading || !projectInput.trim()} 
                className="w-full"
              >
                <Wand2 className="mr-2 h-5 w-5" />
                {isLoading ? '분석 중...' : 'AI 에이전트와 대화 시작'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Analysis and Agent Interaction */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          <Card className="flex-grow flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderTree className="h-5 w-5" />
                프로젝트 구조
              </CardTitle>
              <CardDescription>
                로드된 프로젝트의 파일 구조입니다. 구조를 확인하고 AI 에이전트에게 코드 수정을 요청하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ScrollArea className="h-full min-h-[400px] p-1 border rounded-md bg-muted/30">
                {isLoading && (
                  <div className="p-4 text-center text-muted-foreground animate-pulse">
                    <p>파일 구조를 생성하는 중입니다...</p>
                  </div>
                )}
                {!isLoading && fileTree && (
                  <pre className="p-4 text-sm whitespace-pre-wrap font-mono">{fileTree}</pre>
                )}
                {!isLoading && !fileTree && (
                  <div className="p-4 text-center text-muted-foreground h-full flex flex-col justify-center items-center">
                    <FolderKanban className="h-12 w-12 mb-4 opacity-50" />
                    <p>왼쪽에서 GitHub 저장소나 파일을 로드하세요.</p>
                    <p className="text-xs mt-2">파일 구조가 여기에 표시됩니다.</p>
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
