import { handle, json } from '@/lib/api';
import { ACCOUNT_TYPES, oneOf, qInt, readBody, reqInt } from '@/lib/validate';
import { listAccounts, openAccount } from '@/pgdb/queries/bank';

// GET /api/accounts?customerId=1
export const GET = handle(async (req) => json(await listAccounts(qInt(req.nextUrl.searchParams, 'customerId'))));

// POST /api/accounts  { customerId, branchId, accountType: "SAVINGS" | "CURRENT" }
export const POST = handle(async (req) => {
  const b = await readBody(req);
  return json(await openAccount(reqInt(b, 'customerId'), reqInt(b, 'branchId'), oneOf(b, 'accountType', ACCOUNT_TYPES)), 201);
});
