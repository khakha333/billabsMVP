import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// The GeistSans and GeistMono objects imported from 'geist/font/*'
// already provide the .variable property. No need to instantiate them.

export const metadata: Metadata = {
  title: '코드 인사이트',
  description: 'AI 기반 코드 분석 및 설명 도구',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
