'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client';
import { inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import type { Account, AccountStatus, Branch, Customer } from '@/lib/types';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';

export default function AccountsPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const isAdmin = user?.role === 'ADMIN';

  const accounts = useApi<Account[]>('/api/accounts'); // the API already limits customers to their own accounts
  const customers = useApi<Customer[]>(isCustomer ? null : '/api/customers');
  const branches = useApi<Branch[]>(isCustomer ? null : '/api/branches');
  const [form, setForm] = useState({ customerId: '', branchId: '', accountType: 'SAVINGS' });
  const { run, busy, notice } = useAction();

  async function open(e: FormEvent) {
    e.preventDefault();
    const r = await run(
      () => api<Account>('/api/accounts', {
        method: 'POST',
        body: { customerId: Number(form.customerId), branchId: Number(form.branchId), accountType: form.accountType },
      }),
      (a) => `Account ${a.account_number} opened for ${a.customer_name}`
    );
    if (r) accounts.reload();
  }

  async function setStatus(a: Account, status: AccountStatus) {
    await run(
      () => api(`/api/accounts/${a.account_id}`, { method: 'PATCH', body: { status } }),
      `Account ${a.account_number} is now ${status}`
    );
    accounts.reload();
  }

  return (
    <>
      <PageHeader
        title={isCustomer ? 'My accounts' : 'Accounts'}
        subtitle={isCustomer ? 'Your accounts and balances' : 'vw_account_summary (3-table JOIN). Freeze/close rules are enforced by a trigger.'}
      />
      <Notice notice={notice} />

      {!isCustomer && (
        <Card title="Open an account" className="mb-6">
          <form onSubmit={open} className="grid gap-4 sm:grid-cols-4">
            <Field label="Customer">
              <select required className={inputCls} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Select customer</option>
                {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.full_name}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select required className={inputCls} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">Select branch</option>
                {branches.data?.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputCls} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                <option>SAVINGS</option><option>CURRENT</option>
              </select>
            </Field>
            <div className="flex items-end"><Button type="submit" disabled={busy}>Open account</Button></div>
          </form>
        </Card>
      )}

      <Card>
        <Async state={accounts}>
          {(rows) => (
            <Table headers={isCustomer
              ? ['Account no.', 'Branch', 'Type', 'Balance', 'Status', '']
              : ['Account no.', 'Customer', 'Branch', 'Type', 'Balance', 'Status', 'Actions']}>
              {rows.length === 0 && <EmptyRow cols={7} />}
              {rows.map((a) => (
                <tr key={a.account_id}>
                  <td className={td}>{a.account_number}</td>
                  {!isCustomer && (
                    <td className={td}><Link className="text-indigo-600 hover:underline" href={`/customers/${a.customer_id}`}>{a.customer_name}</Link></td>
                  )}
                  <td className={td}>{a.branch_name}</td>
                  <td className={td}>{a.account_type}</td>
                  <td className={td}>{inr(a.balance)}</td>
                  <td className={td}><Badge>{a.status}</Badge></td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/accounts/${a.account_id}`}><Button size="sm" variant="ghost">Statement</Button></Link>
                      {!isCustomer && a.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={() => setStatus(a, 'FROZEN')}>Freeze</Button>}
                      {!isCustomer && a.status === 'FROZEN' && <Button size="sm" variant="ghost" onClick={() => setStatus(a, 'ACTIVE')}>Unfreeze</Button>}
                      {isAdmin && a.status !== 'CLOSED' && <Button size="sm" variant="danger" onClick={() => setStatus(a, 'CLOSED')}>Close</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
