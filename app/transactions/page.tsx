'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/client';
import { dateTime, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import type { Account, Txn, TxnResult } from '@/lib/types';
import AccountSelect from '@/components/AccountSelect';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';

type Mode = 'deposit' | 'withdraw' | 'transfer';
const blank = { accountId: '', toAccountId: '', amount: '', description: '' };

export default function TransactionsPage() {
  const accounts = useApi<Account[]>('/api/accounts');
  const txns = useApi<Txn[]>('/api/transactions?limit=30');
  const [mode, setMode] = useState<Mode>('deposit');
  const [form, setForm] = useState(blank);
  const { run, busy, notice, setNotice } = useAction();

  const active = (accounts.data ?? []).filter((a) => a.status === 'ACTIVE');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body =
      mode === 'transfer'
        ? { fromAccountId: Number(form.accountId), toAccountId: Number(form.toAccountId), amount: Number(form.amount), description: form.description }
        : { accountId: Number(form.accountId), amount: Number(form.amount), description: form.description };

    const r = await run(
      () => api<TxnResult>(`/api/transactions/${mode}`, { method: 'POST', body }),
      (res) => `Transaction #${res.transaction.txn_id} successful. New balance: ` +
        res.accounts.map((a) => `${a.account_number} → ${inr(a.balance)}`).join(' | ')
    );
    if (r) {
      setForm({ ...form, amount: '', description: '' });
      accounts.reload();
      txns.reload();
    }
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: 'deposit', label: 'Deposit' },
    { key: 'withdraw', label: 'Withdraw' },
    { key: 'transfer', label: 'Transfer' },
  ];

  return (
    <>
      <PageHeader title="Transactions" subtitle="Each action calls a PL/pgSQL function. Failures roll back automatically (ACID)." />

      <Card className="mb-6">
        <div className="mb-4 flex gap-2">
          {tabs.map((t) => (
            <Button key={t.key} variant={mode === t.key ? 'primary' : 'ghost'} onClick={() => { setMode(t.key); setNotice(null); }}>
              {t.label}
            </Button>
          ))}
        </div>

        <Notice notice={notice} />

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={mode === 'transfer' ? 'From account' : 'Account'}>
            <AccountSelect accounts={active} value={form.accountId} onChange={(v) => setForm({ ...form, accountId: v })} />
          </Field>
          {mode === 'transfer' && (
            <Field label="To account">
              <AccountSelect
                accounts={active.filter((a) => String(a.account_id) !== form.accountId)}
                value={form.toAccountId}
                onChange={(v) => setForm({ ...form, toAccountId: v })}
              />
            </Field>
          )}
          <Field label="Amount (₹)">
            <input required type="number" min="0.01" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Description (optional)">
            <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>{busy ? 'Processing…' : `Confirm ${mode}`}</Button>
          </div>
        </form>
      </Card>

      <Card title="Recent transactions (immutable ledger)">
        <Async state={txns}>
          {(rows) => (
            <Table headers={['ID', 'Time', 'Type', 'From', 'To', 'Amount', 'Description']}>
              {rows.length === 0 && <EmptyRow cols={7} />}
              {rows.map((t) => (
                <tr key={t.txn_id}>
                  <td className={td}>#{t.txn_id}</td>
                  <td className={td}>{dateTime(t.txn_time)}</td>
                  <td className={td}><Badge>{t.txn_type}</Badge></td>
                  <td className={td}>{t.from_account_number ?? '—'}</td>
                  <td className={td}>{t.to_account_number ?? '—'}</td>
                  <td className={`${td} font-medium`}>{inr(t.amount)}</td>
                  <td className={td}>{t.description ?? '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
