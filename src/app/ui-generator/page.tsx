"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, WandSparkles, LoaderCircle } from 'lucide-react';
import { CodeDisplay } from '@/components/CodeDisplay';
import { generateUiComponentAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export default function UiGeneratorPage() {
  const [prompt, setPrompt] = useState('');
  const [componentName, setComponentName] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim() || !componentName.trim()) {
      toast({
        title: "입력 필요",
        description: "컴포넌트 설명과 이름을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setGeneratedCode(null);
    try {
      const result = await generateUiComponentAction({ prompt, componentName });
      setGeneratedCode(result.code);
      if (result.code.startsWith('// 입력 오류:')) {
         toast({
            title: "생성 실패",
            description: "입력값을 확인해주세요. 컴포넌트 이름은 PascalCase여야 합니다.",
            variant: "destructive",
        });
      } else {
        toast({
            title: "생성 완료",
            description: `'${componentName}.tsx' 컴포넌트 코드가 생성되었습니다.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setGeneratedCode(`// 오류가 발생했습니다: ${message}`);
       toast({
        title: "생성 중 오류 발생",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="py-4 px-6 border-b border-border shadow-sm bg-card sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WandSparkles className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              AI 컴포넌트 생성기
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
      
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Input */}
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>컴포넌트 설명</CardTitle>
            <CardDescription>
              생성하고 싶은 UI 컴포넌트에 대해 자세히 설명해주세요. shadcn/ui와 Tailwind CSS를 사용하여 코드를 생성합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="component-name" className="text-sm font-medium">컴포넌트 이름 (PascalCase)</label>
              <Input
                id="component-name"
                placeholder="예: UserProfileCard, DataTable"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
               <label htmlFor="prompt" className="text-sm font-medium">상세 설명</label>
              <Textarea
                id="prompt"
                placeholder="예: 사용자의 아바타, 이름, 이메일, 그리고 '프로필 보기' 버튼을 포함하는 사용자 프로필 카드를 만들어줘."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[150px]"
                disabled={isLoading}
              />
            </div>
            <Button onClick={handleGenerate} disabled={isLoading || !prompt || !componentName} className="w-full">
              {isLoading ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <WandSparkles className="mr-2 h-4 w-4" />
                  컴포넌트 생성
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column: Output */}
        <div className="h-full min-h-[400px]">
          {generatedCode ? (
            <CodeDisplay code={generatedCode} fileName={`${componentName}.tsx`} />
          ) : (
            <div className="flex flex-col items-center justify-center bg-card rounded-lg shadow h-full text-center text-muted-foreground p-8">
              <WandSparkles className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-semibold">AI가 컴포넌트 코드를 생성합니다</p>
              <p className="text-sm mt-1">왼쪽 양식을 채우고 '컴포넌트 생성' 버튼을 누르세요.</p>
              {isLoading && (
                 <div className="mt-4 flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <p>코드를 생성하고 있습니다. 잠시만 기다려주세요...</p>
                 </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
