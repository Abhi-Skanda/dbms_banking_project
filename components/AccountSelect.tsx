import { inr } from '@/lib/format';
import type { Account } from '@/lib/types';
import { inputCls } from './ui';

export default function AccountSelect({
  accounts, value, onChange, placeholder = 'Select account',
}: { accounts: Account[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <select required className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {accounts.map((a) => (
        <option key={a.account_id} value={a.account_id}>
          {a.account_number} · {a.customer_name} · {inr(a.balance)}
        </option>
      ))}
    </select>
  );
}
