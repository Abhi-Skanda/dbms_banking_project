'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client';
import { dateTime, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import type { Account, Txn, TxnResult } from '@/lib/types';
import AccountSelect from '@/components/AccountSelect';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';

type Mode = 'deposit' | 'withdraw' | 'transfer';
const blank = { accountId: '', toAccountId: '', amount: '', description: '' };

const doneText = (res: TxnResult) =>
  `Transaction #${res.transaction.txn_id} successful. New balance: ` +
  res.accounts.map((a) => `${a.account_number} → ${inr(a.balance)}`).join(' | ');

export default function TransactionsPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const accounts = useApi<Account[]>('/api/accounts'); // customers: only their own
  const txns = useApi<Txn[]>('/api/transactions?limit=30');
  const active = (accounts.data ?? []).filter((a) => a.status === 'ACTIVE');

  const refreshAll = () => { accounts.reload(); txns.reload(); };

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Transfer money' : 'Transactions'}
        subtitle={isCustomer
          ? 'Send money from your account to your other accounts or to any account number'
          : 'Each action calls a PL/pgSQL function. Failures roll back automatically (ACID).'}
      />

      {isCustomer
        ? <CustomerTransfer accounts={active} onDone={refreshAll} />
        : <StaffForms accounts={active} onDone={refreshAll} />}

      <Card title={isCustomer ? 'My recent transactions' : 'Recent transactions (immutable ledger)'}>
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

// ----------------------------- staff: deposit / withdraw / transfer ----
function StaffForms({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('deposit');
  const [form, setForm] = useState(blank);
  const { run, busy, notice, setNotice } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body =
      mode === 'transfer'
        ? { fromAccountId: Number(form.accountId), toAccountId: Number(form.toAccountId), amount: Number(form.amount), description: form.description }
        : { accountId: Number(form.accountId), amount: Number(form.amount), description: form.description };

    const r = await run(() => api<TxnResult>(`/api/transactions/${mode}`, { method: 'POST', body }), doneText);
    if (r) {
      setForm({ ...form, amount: '', description: '' });
      onDone();
    }
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: 'deposit', label: 'Deposit' },
    { key: 'withdraw', label: 'Withdraw' },
    { key: 'transfer', label: 'Transfer' },
  ];

  return (
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
          <AccountSelect accounts={accounts} value={form.accountId} onChange={(v) => setForm({ ...form, accountId: v })} />
        </Field>
        {mode === 'transfer' && (
          <Field label="To account">
            <AccountSelect
              accounts={accounts.filter((a) => String(a.account_id) !== form.accountId)}
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
  );
}

// ----------------------------- customer: transfer only ----------------
function CustomerTransfer({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [form, setForm] = useState({ from: '', dest: 'other' as 'own' | 'other', toOwn: '', toNumber: '', amount: '', description: '' });
  const { run, busy, notice } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      fromAccountId: Number(form.from),
      amount: Number(form.amount),
      description: form.description,
      ...(form.dest === 'own' ? { toAccountId: Number(form.toOwn) } : { toAccountNumber: form.toNumber.trim() }),
    };
    const r = await run(() => api<TxnResult>('/api/transactions/transfer', { method: 'POST', body }), doneText);
    if (r) {
      setForm({ ...form, amount: '', description: '', toNumber: '' });
      onDone();
    }
  }

  return (
    <Card className="mb-6">
      <Notice notice={notice} />
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="From my account">
          <AccountSelect accounts={accounts} value={form.from} onChange={(v) => setForm({ ...form, from: v })} />
        </Field>

        <Field label="Send to">
          <select className={inputCls} value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value as 'own' | 'other' })}>
            <option value="other">Another account (by account number)</option>
            <option value="own">One of my own accounts</option>
          </select>
        </Field>

        {form.dest === 'own' ? (
          <Field label="To my account">
            <AccountSelect
              accounts={accounts.filter((a) => String(a.account_id) !== form.from)}
              value={form.toOwn}
              onChange={(v) => setForm({ ...form, toOwn: v })}
            />
          </Field>
        ) : (
          <Field label="Recipient account number">
            <input required inputMode="numeric" maxLength={12} placeholder="e.g. 1000000003" className={inputCls}
              value={form.toNumber} onChange={(e) => setForm({ ...form, toNumber: e.target.value })} />
          </Field>
        )}

        <Field label="Amount (₹)">
          <input required type="number" min="0.01" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Note (optional)">
          <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send money'}</Button>
        </div>
      </form>
    </Card>
  );
}
