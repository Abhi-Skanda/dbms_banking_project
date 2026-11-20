import { ANY, handle, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { qInt, qLimit } from '@/lib/validate';
import { accountOwnerId, listTransactions } from '@/pgdb/queries/bank';

// GET /api/transactions?accountId=1&limit=50   (customers: only transactions touching their accounts)
export const GET = handle(async (req, user) => {
  const sp = req.nextUrl.searchParams;
  const accountId = qInt(sp, 'accountId');
  if (user.role === 'CUSTOMER' && accountId != null) assertOwner(user, await accountOwnerId(accountId), 'account');
  return json(await listTransactions(accountId, qLimit(sp, 50), user.role === 'CUSTOMER' ? user.customerId : null));
}, ANY);
