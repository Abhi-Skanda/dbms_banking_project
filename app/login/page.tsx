'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/client';
import { useAuth } from '@/lib/auth-context';
import { useAction } from '@/lib/hooks';
import { Button, Field, Notice, inputCls } from '@/components/ui';

// Demo logins created by db/sql/07_auth.sql. Delete this list for a real deployment.
const DEMO = [
  { label: 'Admin', username: 'admin', password: 'Admin@123' },
  { label: 'Staff (teller)', username: 'teller', password: 'Staff@123' },
  { label: 'Customer (Rahul)', username: 'rahul', password: 'Rahul@123' },
  { label: 'Customer (Sneha)', username: 'sneha', password: 'Sneha@123' },
];

export default function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { run, busy, notice } = useAction();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => api('/api/auth/login', { method: 'POST', body: { username, password } }), 'Signed in');
    if (ok) {
      await refresh();
      router.replace('/');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold text-slate-900">DBMS Bank</div>
          <div className="text-sm text-slate-500">Sign in to continue</div>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {notice?.type === 'err' && <Notice notice={notice} />}
          <div className="space-y-4">
            <Field label="Username">
              <input required autoFocus autoComplete="username" className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Password">
              <input required type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Demo logins (click to fill)</div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.username}
                type="button"
                onClick={() => { setUsername(d.username); setPassword(d.password); }}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs hover:border-indigo-400"
              >
                <div className="font-medium text-slate-800">{d.label}</div>
                <div className="text-slate-500">{d.username} / {d.password}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
