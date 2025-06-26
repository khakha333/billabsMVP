import { Code2, Library, FolderKanban, Component } from 'lucide-react';
import type React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const Header: React.FC = () => {
  return (
    <header className="py-4 px-6 border-b border-border shadow-sm bg-card">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code2 className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">
            코드 인사이트
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ui-generator" passHref>
            <Button variant="outline">
              <Component className="mr-2 h-5 w-5" />
              UI 생성기
            </Button>
          </Link>
          <Link href="/project-helper" passHref>
            <Button variant="outline">
              <FolderKanban className="mr-2 h-5 w-5" />
              프로젝트 도우미
            </Button>
          </Link>
          <Link href="/api-helper" passHref>
            <Button variant="outline">
              <Library className="mr-2 h-5 w-5" />
              API 도우미
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
