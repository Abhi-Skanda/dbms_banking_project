import { ApiError, handlePublic, json } from '@/lib/api';
import { SESSION_COOKIE, SESSION_HOURS, cookieOptions, getSessionUser, hashToken, newToken } from '@/lib/auth';
import { readBody, reqStr } from '@/lib/validate';
import { createSession, login } from '@/pgdb/queries/auth';

// POST /api/auth/login  { username, password }  -> sets an HttpOnly session cookie
export const POST = handlePublic(async (req) => {
  const b = await readBody(req);
  const result = await login(reqStr(b, 'username', 30), reqStr(b, 'password', 200));

  if (result.status === 'LOCKED') throw new ApiError(429, 'Too many failed attempts. Try again in 15 minutes.');
  if (result.status === 'DISABLED') throw new ApiError(403, 'This account has been disabled. Contact the bank.');
  if (result.status !== 'OK' || result.user_id == null) throw new ApiError(401, 'Invalid username or password');

  const token = newToken();
  await createSession(result.user_id, hashToken(token), SESSION_HOURS);

  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_HOURS * 3600 });
  return res;
});
