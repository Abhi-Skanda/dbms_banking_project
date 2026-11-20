import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import Shell from '@/components/Shell';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'DBMS Bank',
  description: 'Banking infrastructure DBMS project',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
