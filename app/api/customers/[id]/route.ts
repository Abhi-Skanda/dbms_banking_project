import { ADMIN_ONLY, ANY, ApiError, found, handleWithId, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { opt, optBool, optStr, readBody, reqDate, reqEmail, reqPhone, reqStr } from '@/lib/validate';
import { deleteCustomer, getCustomer, listAccounts, updateCustomer } from '@/pgdb/queries/bank';

// GET /api/customers/1  -> customer + their accounts (customers: only their own profile)
export const GET = handleWithId(async (_req, id, user) => {
  assertOwner(user, id, 'profile');
  const customer = found(await getCustomer(id), 'Customer');
  return json({ ...customer, accounts: await listAccounts(id) });
}, ANY);

// PATCH /api/customers/1  { fullName?, email?, phone?, dob?, address?, kycVerified? }
// Customers may only change their own email, phone and address.
export const PATCH = handleWithId(async (req, id, user) => {
  const b = await readBody(req);
  if (user.role === 'CUSTOMER') {
    assertOwner(user, id, 'profile');
    if (Object.keys(b).some((k) => !['email', 'phone', 'address'].includes(k))) {
      throw new ApiError(403, 'You can only change your email, phone and address');
    }
  }
  const row = await updateCustomer(id, {
    fullName: opt(b, 'fullName', (x, k) => reqStr(x, k, 100)),
    email: opt(b, 'email', reqEmail),
    phone: opt(b, 'phone', reqPhone),
    dob: opt(b, 'dob', reqDate),
    address: optStr(b, 'address'),
    kycVerified: opt(b, 'kycVerified', optBool),
  });
  return json(found(row, 'Customer'));
}, ANY);

// DELETE /api/customers/1  (admin only; blocked with 409 if the customer still has accounts)
export const DELETE = handleWithId(async (_req, id) => {
  found(await deleteCustomer(id), 'Customer');
  return json({ deleted: id });
}, ADMIN_ONLY);
