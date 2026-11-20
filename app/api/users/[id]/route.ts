import { ADMIN_ONLY, ApiError, handleWithId, json } from '@/lib/api';
import { opt, optBool, readBody, reqStr } from '@/lib/validate';
import { resetPassword, setUserActive } from '@/pgdb/queries/auth';

// PATCH /api/users/3  { isActive?: boolean, password?: string }
export const PATCH = handleWithId(async (req, id, user) => {
  const b = await readBody(req);
  const isActive = opt(b, 'isActive', optBool);
  const password = opt(b, 'password', reqStr);

  if (isActive === null && password === null) throw new ApiError(400, 'Nothing to update');
  if (isActive === false && id === user.userId) throw new ApiError(400, 'You cannot disable your own account');

  if (isActive !== null) await setUserActive(id, isActive);
  if (password !== null) await resetPassword(id, password);
  return json({ ok: true });
}, ADMIN_ONLY);
