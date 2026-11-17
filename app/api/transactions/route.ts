import { handle, json } from '@/lib/api';
import { qInt, qLimit } from '@/lib/validate';
import { listTransactions } from '@/pgdb/queries/bank';

// GET /api/transactions?accountId=1&limit=50
export const GET = handle(async (req) => {
  const sp = req.nextUrl.searchParams;
  return json(await listTransactions(qInt(sp, 'accountId'), qLimit(sp, 50)));
});
