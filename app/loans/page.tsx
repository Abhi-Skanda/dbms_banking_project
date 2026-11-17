'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/client';
import { date, inr } from '@/lib/format';
import { useAction, useApi, useDebounced } from '@/lib/hooks';
import type { Account, Customer, Loan } from '@/lib/types';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';

const STATUSES = ['', 'PENDING', 'ACTIVE', 'CLOSED', 'REJECTED'];

export default function LoansPage() {
  const [status, setStatus] = useState('');
  const loans = useApi<Loan[]>(`/api/loans${status ? `?status=${status}` : ''}`);
  const customers = useApi<Customer[]>('/api/customers');
  const accounts = useApi<Account[]>('/api/accounts');
  const [form, setForm] = useState({ customerId: '', accountId: '', principal: '', rate: '9.5', months: '24' });
  const [selected, setSelected] = useState<number | null>(null);
  const detail = useApi<Loan>(selected ? `/api/loans/${selected}` : null);
  const { run, busy, notice } = useAction();

  // Live EMI preview: calls fn_calculate_emi in the database (debounced)
  const key = useDebounced([form.principal, form.rate, form.months].join('|'), 400);
  const [p, r, m] = key.split('|');
  const validEmi = Number(p) > 0 && r !== '' && Number(r) >= 0 && Number(r) <= 40 && Number.isInteger(Number(m)) && Number(m) >= 1;
  const emi = useApi<{ emi: string }>(validEmi ? `/api/loans/emi?principal=${p}&rate=${r}&months=${m}` : null);

  const ownAccounts = (accounts.data ?? []).filter(
    (a) => a.customer_id === Number(form.customerId) && a.status === 'ACTIVE'
  );

  async function apply(e: FormEvent) {
    e.preventDefault();
    const res = await run(
      () => api<Loan>('/api/loans', {
        method: 'POST',
        body: {
          customerId: Number(form.customerId), accountId: Number(form.accountId),
          principal: Number(form.principal), interestRate: Number(form.rate), tenureMonths: Number(form.months),
        },
      }),
      (l) => `Loan #${l.loan_id} applied. EMI ${inr(l.emi_amount)} — waiting for approval`
    );
    if (res) loans.reload();
  }

  async function action(l: Loan, what: 'approve' | 'reject' | 'pay', okText: string) {
    await run(() => api(`/api/loans/${l.loan_id}/${what}`, { method: 'POST' }), okText);
    loans.reload();
    if (selected === l.loan_id) detail.reload();
  }

  return (
    <>
      <PageHeader title="Loans" subtitle="Apply → approve (disburses money) → pay EMIs → auto-closes after the last EMI" />
      <Notice notice={notice} />

      <Card title="Apply for a loan" className="mb-6">
        <form onSubmit={apply} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer">
            <select required className={inputCls} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, accountId: '' })}>
              <option value="">Select customer</option>
              {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Disbursal / EMI account">
            <select required className={inputCls} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">{form.customerId ? 'Select account' : 'Pick a customer first'}</option>
              {ownAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_number} · {inr(a.balance)}</option>)}
            </select>
          </Field>
          <Field label="Principal (₹)">
            <input required type="number" min="1" step="0.01" className={inputCls} value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
          </Field>
          <Field label="Interest rate (% p.a.)">
            <input required type="number" min="0" max="40" step="0.01" className={inputCls} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </Field>
          <Field label="Tenure (months)">
            <input required type="number" min="1" max="360" className={inputCls} value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} />
          </Field>
          <div className="flex items-end gap-4">
            <Button type="submit" disabled={busy}>Apply</Button>
            {validEmi && emi.data && (
              <div className="text-sm text-slate-600">EMI: <span className="font-semibold text-slate-900">{inr(emi.data.emi)}</span> / month</div>
            )}
          </div>
        </form>
      </Card>

      <Card
        title="All loans (vw_loan_outstanding)"
        action={
          <select className={`${inputCls} !w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        }
      >
        <Async state={loans}>
          {(rows) => (
            <Table headers={['Loan', 'Customer', 'Principal', 'Rate', 'EMI', 'Progress', 'Outstanding', 'Status', 'Actions']}>
              {rows.length === 0 && <EmptyRow cols={9} />}
              {rows.map((l) => (
                <tr key={l.loan_id}>
                  <td className={td}>#{l.loan_id}</td>
                  <td className={td}>{l.customer_name}</td>
                  <td className={td}>{inr(l.principal)}</td>
                  <td className={td}>{l.interest_rate}%</td>
                  <td className={td}>{inr(l.emi_amount)}</td>
                  <td className={`${td} min-w-32`}>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(l.emis_paid / l.tenure_months) * 100}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{l.emis_paid}/{l.tenure_months} EMIs</div>
                  </td>
                  <td className={td}>{inr(l.outstanding)}</td>
                  <td className={td}><Badge>{l.status}</Badge></td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-2">
                    {l.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="success" disabled={busy} onClick={() => action(l, 'approve', `Loan #${l.loan_id} approved and disbursed`)}>Approve</Button>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => action(l, 'reject', `Loan #${l.loan_id} rejected`)}>Reject</Button>
                      </>
                    )}
                    {l.status === 'ACTIVE' && (
                      <Button size="sm" disabled={busy} onClick={() => action(l, 'pay', `EMI paid for loan #${l.loan_id}`)}>Pay EMI</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelected(selected === l.loan_id ? null : l.loan_id)}>
                      {selected === l.loan_id ? 'Hide' : 'Payments'}
                    </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>

      {selected && (
        <Card title={`Payment history — loan #${selected}`} className="mt-6">
          <Async state={detail}>
            {(l) => (
              <>
                <div className="mb-3 text-sm text-slate-600">
                  Started {date(l.start_date)} · Paid {inr(l.total_paid)} of {inr(l.total_payable)}
                </div>
                <Table headers={['#', 'Paid on', 'Txn', 'Amount']}>
                  {(l.payments ?? []).length === 0 && <EmptyRow cols={4} text="No EMIs paid yet" />}
                  {(l.payments ?? []).map((pmt, i) => (
                    <tr key={pmt.payment_id}>
                      <td className={td}>{i + 1}</td>
                      <td className={td}>{date(pmt.paid_on)}</td>
                      <td className={td}>#{pmt.txn_id}</td>
                      <td className={td}>{inr(pmt.amount)}</td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </Async>
        </Card>
      )}
    </>
  );
}
