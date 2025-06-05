import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'API 도우미 - 코드 인사이트',
  description: '다양한 API의 사용법과 예제를 찾아보세요.',
};

export default function ApiHelperPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="py-4 px-6 border-b border-border shadow-sm bg-card">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">
            API 도우미
          </h1>
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-5 w-5" />
              메인으로 돌아가기
            </Button>
          </Link>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">API 선택</h2>
          <p className="text-muted-foreground mb-6">
            알아보고 싶은 API를 선택하거나 검색하세요. 선택된 API에 대한 설명, 주요 함수, 사용 예제 등을 제공합니다.
          </p>
          {/* Placeholder for API selection and display components */}
          <div className="border-2 border-dashed border-border rounded-lg p-10 text-center min-h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground">API 선택 및 정보 표시 기능이 여기에 구현될 예정입니다.</p>
          </div>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        코드 인사이트 &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
