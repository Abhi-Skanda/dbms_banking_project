'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client';
import { date } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import type { Customer } from '@/lib/types';
import { Async, Badge, Button, Card, Field, Notice, PageHeader, inputCls } from '@/components/ui';

export default function ProfilePage() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const customer = useApi<Customer>(isCustomer && user ? `/api/customers/${user.customerId}` : null);
  if (!user) return null;

  return (
    <>
      <PageHeader title="My profile" subtitle="Your sign-in details and password" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Sign-in">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-slate-500">Name</dt><dd>{user.fullName}</dd></div>
            <div><dt className="text-xs text-slate-500">Username</dt><dd>{user.username}</dd></div>
            <div><dt className="text-xs text-slate-500">Role</dt><dd><Badge tone={user.role === 'ADMIN' ? 'red' : user.role === 'STAFF' ? 'blue' : 'slate'}>{user.role}</Badge></dd></div>
          </dl>
        </Card>

        <PasswordForm />

        {isCustomer && (
          <Card title="Personal details" className="lg:col-span-2">
            <Async state={customer}>
              {(c) => <DetailsForm key={c.customer_id} customer={c} onSaved={customer.reload} />}
            </Async>
          </Card>
        )}
      </div>
    </>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const { run, busy, notice, setNotice } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setNotice({ type: 'err', text: 'New passwords do not match' });
      return;
    }
    const r = await run(
      () => api('/api/auth/password', { method: 'POST', body: { currentPassword: form.current, newPassword: form.next } }),
      'Password changed. Other devices were signed out.'
    );
    if (r) setForm({ current: '', next: '', confirm: '' });
  }

  return (
    <Card title="Change password">
      <Notice notice={notice} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password">
          <input required type="password" autoComplete="current-password" className={inputCls} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        </Field>
        <Field label="New password (min 8 characters)">
          <input required minLength={8} type="password" autoComplete="new-password" className={inputCls} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
        </Field>
        <Field label="Confirm new password">
          <input required minLength={8} type="password" autoComplete="new-password" className={inputCls} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <Button type="submit" disabled={busy}>Update password</Button>
      </form>
    </Card>
  );
}

function DetailsForm({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const [form, setForm] = useState({ email: customer.email, phone: customer.phone, address: customer.address ?? '' });
  const { run, busy, notice } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api(`/api/customers/${customer.customer_id}`, { method: 'PATCH', body: form }), 'Details updated');
    if (r) onSaved();
  }

  return (
    <>
      <Notice notice={notice} />
      <div className="mb-4 grid gap-4 text-sm sm:grid-cols-3">
        <div><div className="text-xs text-slate-500">Full name</div>{customer.full_name}</div>
        <div><div className="text-xs text-slate-500">Date of birth</div>{date(customer.dob)}</div>
        <div><div className="text-xs text-slate-500">KYC</div><Badge tone={customer.kyc_verified ? 'green' : 'amber'}>{customer.kyc_verified ? 'Verified' : 'Pending'}</Badge></div>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Email"><input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><input required maxLength={10} className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div><Button type="submit" disabled={busy}>Save changes</Button></div>
      </form>
      <p className="mt-3 text-xs text-slate-400">Name and date of birth can only be changed by the bank.</p>
    </>
  );
}
