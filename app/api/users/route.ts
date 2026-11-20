import { ADMIN_ONLY, ApiError, handle, json } from '@/lib/api';
import { ROLES, oneOf, readBody, reqInt, reqStr } from '@/lib/validate';
import { createUser, listUsers } from '@/pgdb/queries/auth';

export const GET = handle(async () => json(await listUsers()), ADMIN_ONLY);

// POST /api/users  { username, password, role, customerId? | employeeId? }
export const POST = handle(async (req) => {
  const b = await readBody(req);
  const role = oneOf(b, 'role', ROLES);
  const username = reqStr(b, 'username', 30).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new ApiError(400, 'Username: 3-30 letters, digits, . _ -');

  const customerId = role === 'CUSTOMER' ? reqInt(b, 'customerId') : null;
  const employeeId = role !== 'CUSTOMER' ? reqInt(b, 'employeeId') : null;
  const row = await createUser(username, reqStr(b, 'password', 200), role, customerId, employeeId);
  return json(row, 201);
}, ADMIN_ONLY);
