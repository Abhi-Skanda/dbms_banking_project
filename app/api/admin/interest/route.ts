import { ADMIN_ONLY, handle, json } from '@/lib/api';
import { readOptionalBody, reqNum } from '@/lib/validate';
import { applyMonthlyInterest } from '@/pgdb/queries/bank';

// POST /api/admin/interest  { rate?: 4 }  -> credits monthly interest to all active savings accounts (admin only)
export const POST = handle(async (req) => {
  const b = await readOptionalBody(req);
  const rate = b.rate === undefined ? 4 : reqNum(b, 'rate', 0, 20);
  return json(await applyMonthlyInterest(rate));
}, ADMIN_ONLY);
