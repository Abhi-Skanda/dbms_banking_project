import { ANY, handleWithId, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { loanOwnerId, payEmi } from '@/pgdb/queries/bank';

// POST /api/loans/1/pay -> debits one EMI from the loan account (customers: their own loans only)
export const POST = handleWithId(async (_req, id, user) => {
  assertOwner(user, await loanOwnerId(id), 'loan');
  return json(await payEmi(id));
}, ANY);
