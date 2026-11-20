'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client';
import { date } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import type { Account, Card as CardRow } from '@/lib/types';
import AccountSelect from '@/components/AccountSelect';
import { Async, Badge, Button, Card, EmptyRow, Field, Notice, PageHeader, Table, inputCls, td } from '@/components/ui';

export default function CardsPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';

  const cards = useApi<CardRow[]>('/api/cards'); // customers: own cards only
  const accounts = useApi<Account[]>(isCustomer ? null : '/api/accounts');
  const [accountId, setAccountId] = useState('');
  const [cardType, setCardType] = useState('DEBIT');
  const { run, busy, notice } = useAction();

  async function issue(e: FormEvent) {
    e.preventDefault();
    const r = await run(
      () => api<{ card_number: string; expiry_date: string }>('/api/cards', {
        method: 'POST', body: { accountId: Number(accountId), cardType },
      }),
      (c) => `Card issued: ${c.card_number} (expires ${date(c.expiry_date)}). Shown only once.`
    );
    if (r) cards.reload();
  }

  async function setStatus(c: CardRow, status: 'ACTIVE' | 'BLOCKED') {
    await run(() => api(`/api/cards/${c.card_id}`, { method: 'PATCH', body: { status } }), `Card ${c.masked_number} is now ${status}`);
    cards.reload();
  }

  return (
    <>
      <PageHeader
        title={isCustomer ? 'My cards' : 'Cards'}
        subtitle={isCustomer
          ? 'Lost your card? Block it instantly. Contact the bank to unblock or replace it.'
          : 'Card numbers are masked in the API; the full number is returned only at issue time'}
      />
      <Notice notice={notice} />

      {!isCustomer && (
        <Card title="Issue a card" className="mb-6">
          <form onSubmit={issue} className="grid gap-4 sm:grid-cols-3">
            <Field label="Account">
              <AccountSelect accounts={(accounts.data ?? []).filter((a) => a.status === 'ACTIVE')} value={accountId} onChange={setAccountId} />
            </Field>
            <Field label="Type">
              <select className={inputCls} value={cardType} onChange={(e) => setCardType(e.target.value)}>
                <option>DEBIT</option><option>CREDIT</option>
              </select>
            </Field>
            <div className="flex items-end"><Button type="submit" disabled={busy}>Issue card</Button></div>
          </form>
        </Card>
      )}

      <Card>
        <Async state={cards}>
          {(rows) => (
            <Table headers={['Card', 'Account', 'Type', 'Expiry', 'Status', 'Actions']}>
              {rows.length === 0 && <EmptyRow cols={6} />}
              {rows.map((c) => (
                <tr key={c.card_id}>
                  <td className={`${td} font-mono`}>{c.masked_number}</td>
                  <td className={td}>{c.account_number}</td>
                  <td className={td}>{c.card_type}</td>
                  <td className={td}>{date(c.expiry_date)}</td>
                  <td className={td}><Badge>{c.status}</Badge></td>
                  <td className={td}>
                    {c.status === 'ACTIVE' && <Button size="sm" variant="danger" onClick={() => setStatus(c, 'BLOCKED')}>Block card</Button>}
                    {!isCustomer && c.status === 'BLOCKED' && <Button size="sm" variant="ghost" onClick={() => setStatus(c, 'ACTIVE')}>Unblock</Button>}
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
