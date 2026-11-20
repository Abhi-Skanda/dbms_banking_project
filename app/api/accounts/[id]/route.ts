import { ANY, ApiError, found, handleWithId, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { ACCOUNT_STATUSES, oneOf, readBody } from '@/lib/validate';
import { accountOwnerId, getAccount, setAccountStatus } from '@/pgdb/queries/bank';

export const GET = handleWithId(async (_req, id, user) => {
  assertOwner(user, await accountOwnerId(id), 'account');
  return json(found(await getAccount(id), 'Account'));
}, ANY);

// PATCH /api/accounts/1  { status }   staff can freeze/unfreeze; only admin can close
export const PATCH = handleWithId(async (req, id, user) => {
  const status = oneOf(await readBody(req), 'status', ACCOUNT_STATUSES);
  if (status === 'CLOSED' && user.role !== 'ADMIN') throw new ApiError(403, 'Only an administrator can close an account');
  return json(found(await setAccountStatus(id, status), 'Account'));
});
