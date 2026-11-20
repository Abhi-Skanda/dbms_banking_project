'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client';
import { dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { ADMIN_ROLES } from '@/lib/roles';
import type { AppUser, Customer, Employee, Role } from '@/lib/types';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';

function Users() {
  const { user: me } = useAuth();
  const users = useApi<AppUser[]>('/api/users');
  const customers = useApi<Customer[]>('/api/customers');
  const employees = useApi<Employee[]>('/api/employees');
  const [form, setForm] = useState({ role: 'CUSTOMER' as Role, personId: '', username: '', password: '' });
  const { run, busy, notice } = useAction();

  // only people who don't have a login yet
  const hasLogin = (list: AppUser[] | null, key: 'customer_id' | 'employee_id', id: number) => (list ?? []).some((u) => u[key] === id);
  const freeCustomers = (customers.data ?? []).filter((c) => !hasLogin(users.data, 'customer_id', c.customer_id));
  const freeEmployees = (employees.data ?? []).filter((e) => !hasLogin(users.data, 'employee_id', e.employee_id));

  async function create(e: FormEvent) {
    e.preventDefault();
    const body = {
      username: form.username, password: form.password, role: form.role,
      ...(form.role === 'CUSTOMER' ? { customerId: Number(form.personId) } : { employeeId: Number(form.personId) }),
    };
    const r = await run(() => api('/api/users', { method: 'POST', body }), `Login "${form.username}" created`);
    if (r) {
      setForm({ ...form, personId: '', username: '', password: '' });
      users.reload();
    }
  }

  async function toggle(u: AppUser) {
    await run(() => api(`/api/users/${u.user_id}`, { method: 'PATCH', body: { isActive: !u.is_active } }),
      `${u.username} ${u.is_active ? 'disabled (signed out everywhere)' : 'enabled'}`);
    users.reload();
  }

  async function reset(u: AppUser) {
    const pw = window.prompt(`New password for ${u.username} (min 8 characters):`);
    if (!pw) return;
    await run(() => api(`/api/users/${u.user_id}`, { method: 'PATCH', body: { password: pw } }), `Password reset for ${u.username}. They were signed out everywhere.`);
    users.reload();
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Logins for customers and staff. Passwords are stored as bcrypt hashes, accounts lock after 5 failed attempts." />
      <Notice notice={notice} />

      <Card title="Create a login" className="mb-6">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Role">
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, personId: '' })}>
              <option value="CUSTOMER">Customer</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <Field label={form.role === 'CUSTOMER' ? 'Customer' : 'Employee'}>
            <select required className={inputCls} value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })}>
              <option value="">Select…</option>
              {form.role === 'CUSTOMER'
                ? freeCustomers.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.full_name}</option>)
                : freeEmployees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name} ({e.role})</option>)}
            </select>
          </Field>
          <Field label="Username">
            <input required pattern="[a-zA-Z0-9._-]{3,30}" title="3-30 letters, digits, . _ -" className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label="Temporary password">
            <input required minLength={8} type="text" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="flex items-end"><Button type="submit" disabled={busy}>Create login</Button></div>
        </form>
      </Card>

      <Card>
        <Async state={users}>
          {(rows) => (
            <Table headers={['Username', 'Person', 'Role', 'Status', 'Last sign-in', 'Actions']}>
              {rows.length === 0 && <EmptyRow cols={6} />}
              {rows.map((u) => (
                <tr key={u.user_id}>
                  <td className={`${td} font-medium`}>{u.username}</td>
                  <td className={td}>{u.full_name}</td>
                  <td className={td}><Badge tone={u.role === 'ADMIN' ? 'red' : u.role === 'STAFF' ? 'blue' : 'slate'}>{u.role}</Badge></td>
                  <td className={td}>
                    {u.locked ? <Badge tone="amber">LOCKED</Badge> : <Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'ACTIVE' : 'DISABLED'}</Badge>}
                  </td>
                  <td className={td}>{u.last_login ? dateTime(u.last_login) : 'Never'}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => reset(u)}>Reset password</Button>
                      {u.user_id !== me?.userId && (
                        <Button size="sm" variant={u.is_active ? 'danger' : 'success'} onClick={() => toggle(u)}>
                          {u.is_active ? 'Disable' : 'Enable'}
                        </Button>
                      )}
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

export default function UsersPage() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <Users />
    </RequireRole>
  );
}
