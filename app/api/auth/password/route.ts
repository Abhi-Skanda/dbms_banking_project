import { ANY, handle, json } from '@/lib/api';
import { SESSION_COOKIE, hashToken } from '@/lib/auth';
import { readBody, reqStr } from '@/lib/validate';
import { changePassword } from '@/pgdb/queries/auth';

// POST /api/auth/password  { currentPassword, newPassword }  (signs out other devices)
export const POST = handle(async (req, user) => {
  const b = await readBody(req);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  await changePassword(user.userId, reqStr(b, 'currentPassword', 200), reqStr(b, 'newPassword', 200), token ? hashToken(token) : null);
  return json({ ok: true });
}, ANY);
