'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { dateTime, inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Account, StatementEntry } from '@/lib/types';
import { Async, Badge, Button, Card, EmptyRow, Field, PageHeader, Stat, Table, inputCls, td } from '@/components/ui';

export default function StatementPage() {
  const { id } = useParams<{ id: string }>();
  const [limit, setLimit] = useState('20');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = new URLSearchParams({ limit });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const statement = useApi<{ account: Account; entries: StatementEntry[] }>(`/api/accounts/${id}/statement?${params}`);

  return (
    <>
      <PageHeader title="Account statement" subtitle="vw_account_statement: UNION ALL + running balance (SUM OVER window)">
        <Link href="/accounts"><Button variant="ghost">← Back</Button></Link>
      </PageHeader>

      <Async state={statement}>
        {({ account, entries }) => (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-4">
              <Stat label="Account" value={account.account_number} />
              <Stat label="Holder" value={account.customer_name} />
              <Stat label="Balance" value={inr(account.balance)} />
              <Stat label="Status" value={<Badge>{account.status}</Badge>} />
            </div>

            <Card
              title="Transactions"
              action={
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                  <Field label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
                  <Field label="Rows">
                    <select className={inputCls} value={limit} onChange={(e) => setLimit(e.target.value)}>
                      {['10', '20', '50', '100'].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
              }
            >
              <Table headers={['Date', 'Txn', 'Type', 'Description', 'Debit', 'Credit', 'Balance']}>
                {entries.length === 0 && <EmptyRow cols={7} />}
                {entries.map((e) => (
                  <tr key={`${e.txn_id}-${e.direction}`}>
                    <td className={td}>{dateTime(e.txn_time)}</td>
                    <td className={td}>#{e.txn_id}</td>
                    <td className={td}><Badge>{e.txn_type}</Badge></td>
                    <td className={td}>{e.description ?? '—'}</td>
                    <td className={`${td} text-red-600`}>{e.direction === 'DEBIT' ? inr(e.amount) : ''}</td>
                    <td className={`${td} text-emerald-600`}>{e.direction === 'CREDIT' ? inr(e.amount) : ''}</td>
                    <td className={`${td} font-medium`}>{inr(e.running_balance)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </>
        )}
      </Async>
    </>
  );
}
