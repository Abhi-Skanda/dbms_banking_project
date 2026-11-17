import { handle, json } from '@/lib/api';
import { optStr, readBody, reqInt, reqMoney } from '@/lib/validate';
import { withdraw } from '@/pgdb/queries/bank';

// POST /api/transactions/withdraw  { accountId, amount, description? }
export const POST = handle(async (req) => {
  const b = await readBody(req);
  return json(await withdraw(reqInt(b, 'accountId'), reqMoney(b, 'amount'), optStr(b, 'description')), 201);
});
