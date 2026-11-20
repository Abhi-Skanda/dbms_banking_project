'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';

type NavItem = { href: string; label: string; customerLabel?: string; roles: Role[] };

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', customerLabel: 'Overview', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { href: '/customers', label: 'Customers', roles: ['ADMIN', 'STAFF'] },
  { href: '/accounts', label: 'Accounts', customerLabel: 'My accounts', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { href: '/transactions', label: 'Transactions', customerLabel: 'Transfer money', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { href: '/loans', label: 'Loans', customerLabel: 'My loans', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { href: '/cards', label: 'Cards', customerLabel: 'My cards', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { href: '/branches', label: 'Branches & Staff', roles: ['ADMIN', 'STAFF'] },
  { href: '/audit', label: 'Audit log', roles: ['ADMIN'] },
  { href: '/users', label: 'Users', roles: ['ADMIN'] },
  { href: '/profile', label: 'My profile', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
];

export default function Sidebar() {
  const path = usePathname();
  const { user, logout } = useAuth();
  if (!user) return null;

  const links = NAV.filter((n) => n.roles.includes(user.role)).map((n) => ({
    href: n.href,
    label: user.role === 'CUSTOMER' && n.customerLabel ? n.customerLabel : n.label,
  }));
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 self-start overflow-y-auto bg-slate-900 p-4 md:flex">
        <div className="px-2">
          <div className="text-lg font-semibold text-white">DBMS Bank</div>
          <div className="text-xs text-slate-400">{user.role === 'CUSTOMER' ? 'Online banking' : 'Core banking console'}</div>
        </div>

        {/* signed-in user + Sign out at the TOP so nothing (e.g. the Next.js dev badge) can cover it */}
        <div className="rounded-lg bg-slate-800 p-3">
          <div className="truncate text-sm font-medium text-white">{user.fullName}</div>
          <div className="mb-3 text-xs text-slate-400">@{user.username} · {user.role.toLowerCase()}</div>
          <button
            onClick={logout}
            className="w-full rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm transition ${
                active(l.href) ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="sticky top-0 z-10 flex items-center bg-slate-900 md:hidden">
        <nav className="flex flex-1 gap-1 overflow-x-auto p-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active(l.href) ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="m-2 shrink-0 rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    </>
  );
}
