import { found, handleWithId, json } from '@/lib/api';
import { opt, optBool, optStr, readBody, reqDate, reqEmail, reqPhone, reqStr } from '@/lib/validate';
import { deleteCustomer, getCustomer, listAccounts, updateCustomer } from '@/pgdb/queries/bank';

// GET /api/customers/1  -> customer + their accounts
export const GET = handleWithId(async (_req, id) => {
  const customer = found(await getCustomer(id), 'Customer');
  return json({ ...customer, accounts: await listAccounts(id) });
});

// PATCH /api/customers/1  { fullName?, email?, phone?, dob?, address?, kycVerified? }
export const PATCH = handleWithId(async (req, id) => {
  const b = await readBody(req);
  const row = await updateCustomer(id, {
    fullName: opt(b, 'fullName', (x, k) => reqStr(x, k, 100)),
    email: opt(b, 'email', reqEmail),
    phone: opt(b, 'phone', reqPhone),
    dob: opt(b, 'dob', reqDate),
    address: optStr(b, 'address'),
    kycVerified: opt(b, 'kycVerified', optBool),
  });
  return json(found(row, 'Customer'));
});

// DELETE /api/customers/1  (blocked with 409 if the customer still has accounts)
export const DELETE = handleWithId(async (_req, id) => {
  found(await deleteCustomer(id), 'Customer');
  return json({ deleted: id });
});
