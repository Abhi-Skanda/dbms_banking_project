import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { NoticeState } from '@/lib/hooks';

export const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export const td = 'px-3 py-2 align-middle';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-slate-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
};

export function Button({
  variant = 'primary', size = 'md', className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
      } ${variants[variant]} ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const tones: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-sky-100 text-sky-700',
  slate: 'bg-slate-100 text-slate-600',
};

const toneOf: Record<string, string> = {
  ACTIVE: 'green', DEPOSIT: 'green', INSERT: 'green', CREDIT: 'green',
  FROZEN: 'blue', TRANSFER: 'blue', UPDATE: 'blue',
  PENDING: 'amber', ALERT: 'amber',
  CLOSED: 'slate',
  REJECTED: 'red', BLOCKED: 'red', EXPIRED: 'red', WITHDRAWAL: 'red', DELETE: 'red', DEBIT: 'red',
};

export function Badge({ children, tone }: { children: string; tone?: keyof typeof tones }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone ?? toneOf[children] ?? 'slate']}`}>
      {children}
    </span>
  );
}

export function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null;
  return (
    <div
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${
        notice.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {notice.text}
    </div>
  );
}

export function Loading() {
  return <div className="py-6 text-center text-sm text-slate-400">Loading…</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {message} {onRetry && <button onClick={onRetry} className="ml-2 underline">Retry</button>}
    </div>
  );
}

/** Shows loading / error, otherwise renders children(data). */
export function Async<T>({
  state, children,
}: {
  state: { data: T | null; error: string | null; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.error && !state.data) return <ErrorBox message={state.error} onRetry={state.reload} />;
  if (!state.data) return <Loading />;
  return <>{children(state.data)}</>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ cols, text = 'No records found' }: { cols: number; text?: string }) {
  return <tr><td colSpan={cols} className="px-3 py-6 text-center text-slate-400">{text}</td></tr>;
}
