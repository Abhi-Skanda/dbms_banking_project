import { ANY, handle, json } from '@/lib/api';
import { ACCOUNT_TYPES, oneOf, qInt, readBody, reqInt } from '@/lib/validate';
import { listAccounts, openAccount } from '@/pgdb/queries/bank';

// GET /api/accounts?customerId=1   (customers always get only their own accounts)
export const GET = handle(async (req, user) => {
  const customerId = user.role === 'CUSTOMER' ? user.customerId : qInt(req.nextUrl.searchParams, 'customerId');
  return json(await listAccounts(customerId));
}, ANY);

// POST /api/accounts  { customerId, branchId, accountType }   (staff only)
export const POST = handle(async (req) => {
  const b = await readBody(req);
  return json(await openAccount(reqInt(b, 'customerId'), reqInt(b, 'branchId'), oneOf(b, 'accountType', ACCOUNT_TYPES)), 201);
});
