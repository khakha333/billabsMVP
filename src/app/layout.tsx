import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// The GeistSans and GeistMono objects imported from 'geist/font/*'
// already provide the .variable property. No need to instantiate them.

export const metadata: Metadata = {
  title: 'Code Insights',
  description: 'AI-powered code analysis and explanation tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
