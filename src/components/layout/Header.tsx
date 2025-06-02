import { Code2 } from 'lucide-react';
import type React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="py-4 px-6 border-b border-border shadow-sm bg-card">
      <div className="container mx-auto flex items-center gap-3">
        <Code2 className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">
          코드 인사이트
        </h1>
      </div>
    </header>
  );
};
