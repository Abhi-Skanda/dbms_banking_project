'use client';
import Link from 'next/link';
import { inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { BranchSummary, DashboardStats, MonthlyVolume, TopCustomer } from '@/lib/types';
import { Async, Card, EmptyRow, PageHeader, Stat, Table, td } from '@/components/ui';

export default function DashboardPage() {
  const stats = useApi<DashboardStats>('/api/reports/dashboard');
  const branches = useApi<BranchSummary[]>('/api/reports/branch-summary');
  const top = useApi<TopCustomer[]>('/api/reports/top-customers?limit=5');
  const monthly = useApi<MonthlyVolume[]>('/api/reports/monthly-volume');

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live numbers straight from PostgreSQL views and aggregate queries" />

      <Async state={stats}>
        {(s) => (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            <Stat label="Customers" value={s.customers} />
            <Stat label="Open accounts" value={s.accounts} />
            <Stat label="Total deposits" value={inr(s.total_deposits)} />
            <Stat label="Active loans" value={s.active_loans} />
            <Stat label="Pending loans" value={s.pending_loans} />
            <Stat label="Txns today" value={s.transactions_today} />
          </div>
        )}
      </Async>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card title="Branch summary (vw_branch_summary)">
          <Async state={branches}>
            {(rows) => (
              <Table headers={['Branch', 'Accounts', 'Deposits', 'Active loans', 'Loan principal']}>
                {rows.length === 0 && <EmptyRow cols={5} />}
                {rows.map((b) => (
                  <tr key={b.branch_id}>
                    <td className={td}>{b.branch_name}<div className="text-xs text-slate-400">{b.city}</div></td>
                    <td className={td}>{b.total_accounts}</td>
                    <td className={td}>{inr(b.total_deposits)}</td>
                    <td className={td}>{b.active_loans}</td>
                    <td className={td}>{inr(b.loan_principal)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Async>
        </Card>

        <Card title="Top customers by balance (window function: DENSE_RANK)">
          <Async state={top}>
            {(rows) => (
              <Table headers={['Rank', 'Customer', 'Accounts', 'Total balance']}>
                {rows.length === 0 && <EmptyRow cols={4} />}
                {rows.map((c) => (
                  <tr key={c.customer_id}>
                    <td className={td}>#{c.rank}</td>
                    <td className={td}><Link className="text-indigo-600 hover:underline" href={`/customers/${c.customer_id}`}>{c.full_name}</Link></td>
                    <td className={td}>{c.accounts}</td>
                    <td className={td}>{inr(c.total_balance)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Async>
        </Card>

        <Card title="Monthly transaction volume (CTE + GROUP BY)" className="2xl:col-span-2">
          <Async state={monthly}>
            {(rows) => {
              const months = [...new Set(rows.map((r) => r.month))];
              const cell = (m: string, t: string) => rows.find((r) => r.month === m && r.txn_type === t);
              return (
                <Table headers={['Month', 'Deposits', 'Withdrawals', 'Transfers']}>
                  {months.length === 0 && <EmptyRow cols={4} />}
                  {months.map((m) => (
                    <tr key={m}>
                      <td className={td}>{m}</td>
                      {['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'].map((t) => {
                        const c = cell(m, t);
                        return <td key={t} className={td}>{c ? `${inr(c.volume)} (${c.count})` : '—'}</td>;
                      })}
                    </tr>
                  ))}
                </Table>
              );
            }}
          </Async>
        </Card>
      </div>
    </>
  );
}