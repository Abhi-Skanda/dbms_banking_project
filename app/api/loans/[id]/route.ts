import { ANY, found, handleWithId, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { getLoan, loanOwnerId } from '@/pgdb/queries/bank';

// GET /api/loans/1 -> loan + progress + payment history
export const GET = handleWithId(async (_req, id, user) => {
  assertOwner(user, await loanOwnerId(id), 'loan');
  return json(found(await getLoan(id), 'Loan'));
}, ANY);
