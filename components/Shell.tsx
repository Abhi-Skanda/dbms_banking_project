'use client';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';

/** Login page = bare; everything else = sidebar + content, only for signed-in users. */
export default function Shell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && path !== '/login') router.replace('/login');
  }, [loading, user, path, router]);

  if (path === '/login') return <>{children}</>;

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Suspense fallback={<div className="py-6 text-center text-sm text-slate-400">Loading…</div>}>{children}</Suspense>
      </main>
    </div>
  );
}
