'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/customers', label: 'Customers' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/loans', label: 'Loans' },
  { href: '/cards', label: 'Cards' },
  { href: '/branches', label: 'Branches & Staff' },
  { href: '/audit', label: 'Audit Log' },
];

export default function Sidebar() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 p-4 md:flex">
        <div className="mb-8 px-2">
          <div className="text-lg font-semibold text-white">DBMS Bank</div>
          <div className="text-xs text-slate-400">Core banking console</div>
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

      <nav className="flex gap-1 overflow-x-auto bg-slate-900 p-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              active(l.href) ? 'bg-indigo-600 text-white' : 'text-slate-300'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
