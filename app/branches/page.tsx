'use client';
import { useState } from 'react';
import { date, inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { BranchSummary, Employee } from '@/lib/types';
import { Async, Card, EmptyRow, PageHeader, Table, inputCls, td } from '@/components/ui';

export default function BranchesPage() {
  const branches = useApi<BranchSummary[]>('/api/reports/branch-summary');
  const [branchId, setBranchId] = useState('');
  const employees = useApi<Employee[]>(`/api/employees${branchId ? `?branchId=${branchId}` : ''}`);

  return (
    <>
      <PageHeader title="Branches & Staff" subtitle="Aggregates per branch, and an employee → manager self-join" />

      <Card title="Branch performance" className="mb-6">
        <Async state={branches}>
          {(rows) => (
            <Table headers={['Branch', 'City', 'Accounts', 'Deposits', 'Active loans', 'Loan principal']}>
              {rows.length === 0 && <EmptyRow cols={6} />}
              {rows.map((b) => (
                <tr key={b.branch_id}>
                  <td className={`${td} font-medium`}>{b.branch_name}</td>
                  <td className={td}>{b.city}</td>
                  <td className={td}>{b.total_accounts}</td>
                  <td className={td}>{inr(b.total_deposits)}</td>
                  <td className={td}>{b.active_loans}</td>
                  <td className={td}>{inr(b.loan_principal)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>

      <Card
        title="Employees"
        action={
          <select className={`${inputCls} !w-52`} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.data?.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        }
      >
        <Async state={employees}>
          {(rows) => (
            <Table headers={['Name', 'Role', 'Branch', 'Reports to', 'Salary', 'Hired']}>
              {rows.length === 0 && <EmptyRow cols={6} />}
              {rows.map((e) => (
                <tr key={e.employee_id}>
                  <td className={`${td} font-medium`}>{e.full_name}</td>
                  <td className={td}>{e.role}</td>
                  <td className={td}>{e.branch_name}</td>
                  <td className={td}>{e.manager_name ?? '—'}</td>
                  <td className={td}>{inr(e.salary)}</td>
                  <td className={td}>{date(e.hire_date)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
