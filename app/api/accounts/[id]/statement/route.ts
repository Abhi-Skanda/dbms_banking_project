import { ANY, found, handleWithId, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { qDate, qLimit } from '@/lib/validate';
import { accountOwnerId, accountStatement, getAccount } from '@/pgdb/queries/bank';

// GET /api/accounts/1/statement?limit=20&from=2026-01-01&to=2026-12-31
export const GET = handleWithId(async (req, id, user) => {
  assertOwner(user, await accountOwnerId(id), 'account');
  const sp = req.nextUrl.searchParams;
  const account = found(await getAccount(id), 'Account');
  const entries = await accountStatement(id, qLimit(sp), qDate(sp, 'from'), qDate(sp, 'to'));
  return json({ account, entries });
}, ANY);
