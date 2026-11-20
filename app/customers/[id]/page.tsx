'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/client';
import { date, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import type { Account, Branch, Customer, Loan } from '@/lib/types';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';
import RequireRole from '@/components/RequireRole';
import { STAFF_ROLES } from '@/lib/roles';

function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const customer = useApi<Customer & { accounts: Account[] }>(`/api/customers/${id}`);
  const loans = useApi<Loan[]>(`/api/loans?customerId=${id}`);
  const branches = useApi<Branch[]>('/api/branches');
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState('SAVINGS');
  const { run, busy, notice } = useAction();

  async function openAccount(e: FormEvent) {
    e.preventDefault();
    const r = await run(
      () => api<Account>('/api/accounts', { method: 'POST', body: { customerId: Number(id), branchId: Number(branchId), accountType: type } }),
      (a) => `Account ${a.account_number} opened`
    );
    if (r) customer.reload();
  }

  return (
    <>
      <Async state={customer}>
        {(c) => (
          <>
            <PageHeader title={c.full_name} subtitle={`Customer #${c.customer_id}`}>
              <Link href="/customers"><Button variant="ghost">← Back</Button></Link>
            </PageHeader>
            <Notice notice={notice} />

            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Profile">
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-xs text-slate-500">Email</dt><dd>{c.email}</dd></div>
                  <div><dt className="text-xs text-slate-500">Phone</dt><dd>{c.phone}</dd></div>
                  <div><dt className="text-xs text-slate-500">Date of birth</dt><dd>{date(c.dob)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Address</dt><dd>{c.address ?? '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">KYC</dt><dd><Badge tone={c.kyc_verified ? 'green' : 'amber'}>{c.kyc_verified ? 'Verified' : 'Pending'}</Badge></dd></div>
                </dl>
              </Card>

              <Card title="Open a new account" className="lg:col-span-2">
                <form onSubmit={openAccount} className="grid gap-4 sm:grid-cols-3">
                  <Field label="Branch">
                    <select required className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                      <option value="">Select branch</option>
                      {branches.data?.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Type">
                    <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                      <option>SAVINGS</option><option>CURRENT</option>
                    </select>
                  </Field>
                  <div className="flex items-end"><Button type="submit" disabled={busy}>Open account</Button></div>
                </form>
              </Card>

              <Card title="Accounts" className="lg:col-span-3">
                <Table headers={['Account no.', 'Type', 'Branch', 'Balance', 'Status', '']}>
                  {c.accounts.length === 0 && <EmptyRow cols={6} text="No accounts yet" />}
                  {c.accounts.map((a) => (
                    <tr key={a.account_id}>
                      <td className={td}>{a.account_number}</td>
                      <td className={td}>{a.account_type}</td>
                      <td className={td}>{a.branch_name}</td>
                      <td className={td}>{inr(a.balance)}</td>
                      <td className={td}><Badge>{a.status}</Badge></td>
                      <td className={td}><Link className="text-indigo-600 hover:underline" href={`/accounts/${a.account_id}`}>Statement</Link></td>
                    </tr>
                  ))}
                </Table>
              </Card>

              <Card title="Loans" className="lg:col-span-3">
                <Async state={loans}>
                  {(rows) => (
                    <Table headers={['Loan', 'Principal', 'EMI', 'Paid', 'Outstanding', 'Status']}>
                      {rows.length === 0 && <EmptyRow cols={6} text="No loans" />}
                      {rows.map((l) => (
                        <tr key={l.loan_id}>
                          <td className={td}>#{l.loan_id}</td>
                          <td className={td}>{inr(l.principal)}</td>
                          <td className={td}>{inr(l.emi_amount)}</td>
                          <td className={td}>{l.emis_paid}/{l.tenure_months}</td>
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
        )}
      </Async>
    </>
  );
}

export default function CustomerDetailPage() {
  return (
    <RequireRole roles={STAFF_ROLES}>
      <CustomerDetail />
    </RequireRole>
  );
}
