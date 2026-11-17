import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'DBMS Bank',
  description: 'Banking infrastructure DBMS project',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col md:flex-row">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Suspense fallback={<div className="py-6 text-center text-sm text-slate-400">Loading…</div>}>
            {children}
          </Suspense>
        </main>
      </body>
    </html>
  );
}