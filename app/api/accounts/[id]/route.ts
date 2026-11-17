import { found, handleWithId, json } from '@/lib/api';
import { ACCOUNT_STATUSES, oneOf, readBody } from '@/lib/validate';
import { getAccount, setAccountStatus } from '@/pgdb/queries/bank';

export const GET = handleWithId(async (_req, id) => json(found(await getAccount(id), 'Account')));

// PATCH /api/accounts/1  { status: "ACTIVE" | "FROZEN" | "CLOSED" }
// The DB trigger rejects closing an account with a non-zero balance.
export const PATCH = handleWithId(async (req, id) => {
  const b = await readBody(req);
  return json(found(await setAccountStatus(id, oneOf(b, 'status', ACCOUNT_STATUSES)), 'Account'));
});
  