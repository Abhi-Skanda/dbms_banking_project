'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { dateTime, inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Account, Card as CardRow, Loan, Txn } from '@/lib/types';
import { Async, Badge, Card, EmptyRow, PageHeader, Stat, Table, td } from './ui';

export default function CustomerHome() {
  const { user } = useAuth();
  const accounts = useApi<Account[]>('/api/accounts');
  const txns = useApi<Txn[]>('/api/transactions?limit=6');
  const loans = useApi<Loan[]>('/api/loans');
  const cards = useApi<CardRow[]>('/api/cards');

  return (
    <>
      <PageHeader title={`Welcome, ${user?.fullName.split(' ')[0] ?? ''}`} subtitle="Your accounts, loans and recent activity" />

      <Async state={accounts}>
        {(accs) => {
          const mine = new Set(accs.map((a) => a.account_id));
          const total = accs.filter((a) => a.status !== 'CLOSED').reduce((sum, a) => sum + Number(a.balance), 0);
          const activeLoans = (loans.data ?? []).filter((l) => l.status === 'ACTIVE').length;

          return (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Total balance" value={inr(total)} />
                <Stat label="Accounts" value={accs.length} />
                <Stat label="Active loans" value={activeLoans} />
                <Stat label="Cards" value={cards.data?.length ?? '—'} />
              </div>

              <div className="grid gap-6 2xl:grid-cols-2">
                <Card title="My accounts">
                  <Table headers={['Account no.', 'Type', 'Balance', 'Status', '']}>
                    {accs.length === 0 && <EmptyRow cols={5} />}
                    {accs.map((a) => (
                      <tr key={a.account_id}>
                        <td className={td}>{a.account_number}</td>
                        <td className={td}>{a.account_type}</td>
                        <td className={`${td} font-medium`}>{inr(a.balance)}</td>
                        <td className={td}><Badge>{a.status}</Badge></td>
                        <td className={td}><Link className="text-indigo-600 hover:underline" href={`/accounts/${a.account_id}`}>Statement</Link></td>
                      </tr>
                    ))}
                  </Table>
                </Card>

                <Card title="Recent activity">
                  <Async state={txns}>
                    {(rows) => (
                      <Table headers={['Date', 'Description', 'Amount']}>
                        {rows.length === 0 && <EmptyRow cols={3} />}
                        {rows.map((t) => {
                          const out = t.from_account_id != null && mine.has(t.from_account_id);
                          const inn = t.to_account_id != null && mine.has(t.to_account_id);
                          const sign = out && inn ? '' : out ? '−' : '+';
                          const color = out && inn ? 'text-slate-600' : out ? 'text-red-600' : 'text-emerald-600';
                          return (
                            <tr key={t.txn_id}>
                              <td className={td}>{dateTime(t.txn_time)}</td>
                              <td className={td}>
                                {t.description ?? t.txn_type}
                                <div className="text-xs text-slate-400">{t.txn_type}</div>
                              </td>
                              <td className={`${td} font-medium ${color}`}>{sign}{inr(t.amount)}</td>
                            </tr>
                          );
                        })}
                      </Table>
                    )}
                  </Async>
                </Card>

                <Card title="My loans" className="2xl:col-span-2">
                  <Async state={loans}>
                    {(rows) => (
                      <Table headers={['Loan', 'Principal', 'EMI', 'Progress', 'Outstanding', 'Status']}>
                        {rows.length === 0 && <EmptyRow cols={6} text="No loans yet" />}
                        {rows.map((l) => (
                          <tr key={l.loan_id}>
                            <td className={td}>#{l.loan_id}</td>
                            <td className={td}>{inr(l.principal)}</td>
                            <td className={td}>{inr(l.emi_amount)}</td>
                            <td className={td}>{l.emis_paid}/{l.tenure_months} EMIs</td>
                            <td className={td}>{inr(l.outstanding)}</td>
                            <td className={td}><Badge>{l.status}</Badge></td>
                          </tr>
                        ))}
                      </Table>
                    )}
                  </Async>
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
