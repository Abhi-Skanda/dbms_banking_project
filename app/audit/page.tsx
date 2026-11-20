'use client';
import { useState } from 'react';
import { dateTime, inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { AuditEntry } from '@/lib/types';
import { Async, Badge, Card, EmptyRow, Field, PageHeader, Table, inputCls, td } from '@/components/ui';
import RequireRole from '@/components/RequireRole';
import { ADMIN_ROLES } from '@/lib/roles';

const show = (v: unknown) => (v === null || v === undefined ? 'null' : String(v));

/** Human-readable summary of what a trigger recorded. */
function describe(a: AuditEntry): string[] {
  if (a.operation === 'ALERT') {
    return [`${show(a.new_data?.reason)}: ${inr(a.new_data?.amount as number)} (${show(a.new_data?.type)})`];
  }
  if (a.operation === 'UPDATE' && a.old_data && a.new_data) {
    const changed = Object.keys(a.new_data).filter((k) => JSON.stringify(a.old_data![k]) !== JSON.stringify(a.new_data![k]));
    return changed.map((k) => `${k}: ${show(a.old_data![k])} → ${show(a.new_data![k])}`);
  }
  if (a.operation === 'INSERT') return ['New row created'];
  return ['Row deleted'];
}

function Audit() {
  const [table, setTable] = useState('');
  const [operation, setOperation] = useState('');
  const [limit, setLimit] = useState('50');

  const params = new URLSearchParams({ limit });
  if (table) params.set('table', table);
  if (operation) params.set('operation', operation);
  const audit = useApi<AuditEntry[]>(`/api/audit?${params}`);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Filled automatically by database triggers. The “By” column is the signed-in user who made the change." />

      <Card
        action={
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Table">
              <select className={inputCls} value={table} onChange={(e) => setTable(e.target.value)}>
                <option value="">All</option><option>account</option><option>customer</option><option>loan</option><option>transactions</option><option>app_user</option>
              </select>
            </Field>
            <Field label="Operation">
              <select className={inputCls} value={operation} onChange={(e) => setOperation(e.target.value)}>
                <option value="">All</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option><option>ALERT</option>
              </select>
            </Field>
            <Field label="Rows">
              <select className={inputCls} value={limit} onChange={(e) => setLimit(e.target.value)}>
                {['25', '50', '100', '200'].map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
          </div>
        }
      >
        <Async state={audit}>
          {(rows) => (
            <Table headers={['Time', 'Table', 'Operation', 'Record', 'What changed', 'By']}>
              {rows.length === 0 && <EmptyRow cols={6} />}
              {rows.map((a) => (
                <tr key={a.log_id}>
                  <td className={`${td} whitespace-nowrap`}>{dateTime(a.changed_at)}</td>
                  <td className={td}>{a.table_name}</td>
                  <td className={td}><Badge>{a.operation}</Badge></td>
                  <td className={td}>{a.record_id ?? '—'}</td>
                  <td className={`${td} text-xs text-slate-600`}>
                    {describe(a).map((line, i) => <div key={i}>{line}</div>)}
                  </td>
                  <td className={td}>{a.changed_by}</td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}

export default function AuditPage() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <Audit />
    </RequireRole>
  );
}
