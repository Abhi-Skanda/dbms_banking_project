import { ANY, ApiError, handle, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { optStr, readBody, reqInt, reqMoney, reqStr } from '@/lib/validate';
import { accountIdByNumber, accountOwnerId, transfer } from '@/pgdb/queries/bank';

// POST /api/transactions/transfer
//   { fromAccountId, amount, description?, toAccountId | toAccountNumber }
// Customers can only debit their OWN accounts, and reach other people's accounts by number.
export const POST = handle(async (req, user) => {
  const b = await readBody(req);
  const from = reqInt(b, 'fromAccountId');
  assertOwner(user, await accountOwnerId(from), 'account');

  let to: number;
  if (typeof b.toAccountNumber === 'string' && b.toAccountNumber.trim() !== '') {
    const id = await accountIdByNumber(reqStr(b, 'toAccountNumber', 12));
    if (id == null) throw new ApiError(404, 'Destination account not found');
    to = id;
  } else {
    to = reqInt(b, 'toAccountId');
    assertOwner(user, await accountOwnerId(to), 'destination account'); // customers: own accounts only
  }

  return json(await transfer(from, to, reqMoney(b, 'amount'), optStr(b, 'description')), 201);
}, ANY);
