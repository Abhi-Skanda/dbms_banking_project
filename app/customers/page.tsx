'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from '@/lib/client';
import { date } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { useAction, useApi, useDebounced } from '@/lib/hooks';
import type { Customer } from '@/lib/types';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';
import RequireRole from '@/components/RequireRole';
import { STAFF_ROLES } from '@/lib/roles';

const empty = { fullName: '', email: '', phone: '', dob: '', address: '' };

function Customers() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const customers = useApi<Customer[]>(`/api/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const { run, busy, notice } = useAction();

  const bind = (k: keyof typeof empty) => ({
    value: form[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    const r = await run(
      () => api<Customer>('/api/customers', { method: 'POST', body: form }),
      (c) => `Customer #${c.customer_id} (${c.full_name}) created`
    );
    if (r) { setForm(empty); customers.reload(); }
  }

  async function toggleKyc(c: Customer) {
    await run(
      () => api(`/api/customers/${c.customer_id}`, { method: 'PATCH', body: { kycVerified: !c.kyc_verified } }),
      `KYC updated for ${c.full_name}`
    );
    customers.reload();
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.full_name}?`)) return;
    await run(() => api(`/api/customers/${c.customer_id}`, { method: 'DELETE' }), `${c.full_name} deleted`);
    customers.reload();
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="INSERT / UPDATE / DELETE with constraints and triggers (18+ age check, unique email/phone)">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Close form' : 'Add customer'}</Button>
      </PageHeader>

      <Notice notice={notice} />

      {showForm && (
        <Card title="New customer" className="mb-6">
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name"><input required className={inputCls} {...bind('fullName')} /></Field>
            <Field label="Email"><input required type="email" className={inputCls} {...bind('email')} /></Field>
            <Field label="Phone (10 digits)"><input required className={inputCls} maxLength={10} {...bind('phone')} /></Field>
            <Field label="Date of birth"><input required type="date" className={inputCls} {...bind('dob')} /></Field>
            <Field label="Address"><input className={inputCls} {...bind('address')} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={busy}>Create customer</Button></div>
          </form>
        </Card>
      )}

      <Card
        action={
          <input
            placeholder="Search name or email…"
            className={`${inputCls} !w-64`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      >
        <Async state={customers}>
          {(rows) => (
            <Table headers={['ID', 'Name', 'Email', 'Phone', 'DOB', 'KYC', 'Actions']}>
              {rows.length === 0 && <EmptyRow cols={7} />}
              {rows.map((c) => (
                <tr key={c.customer_id}>
                  <td className={td}>{c.customer_id}</td>
                  <td className={td}>
                    <Link className="font-medium text-indigo-600 hover:underline" href={`/customers/${c.customer_id}`}>{c.full_name}</Link>
                  </td>
                  <td className={td}>{c.email}</td>
                  <td className={td}>{c.phone}</td>
                  <td className={td}>{date(c.dob)}</td>
                  <td className={td}><Badge tone={c.kyc_verified ? 'green' : 'amber'}>{c.kyc_verified ? 'Verified' : 'Pending'}</Badge></td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => toggleKyc(c)}>{c.kyc_verified ? 'Unverify' : 'Verify KYC'}</Button>
                    {user?.role === 'ADMIN' && <Button size="sm" variant="danger" onClick={() => remove(c)}>Delete</Button>}
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

export default function CustomersPage() {
  return (
    <RequireRole roles={STAFF_ROLES}>
      <Customers />
    </RequireRole>
  );
}
