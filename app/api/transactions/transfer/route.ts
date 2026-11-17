import { handle, json } from '@/lib/api';
import { optStr, readBody, reqInt, reqMoney } from '@/lib/validate';
import { transfer } from '@/pgdb/queries/bank';

// POST /api/transactions/transfer  { fromAccountId, toAccountId, amount, description? }
// All-or-nothing: if anything fails inside fn_transfer, nothing is saved.
export const POST = handle(async (req) => {
  const b = await readBody(req);
  const result = await transfer(
    reqInt(b, 'fromAccountId'), reqInt(b, 'toAccountId'), reqMoney(b, 'amount'), optStr(b, 'description')
  );
  return json(result, 201);
});
