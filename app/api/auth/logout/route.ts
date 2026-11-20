import { handlePublic, json } from '@/lib/api';
import { SESSION_COOKIE, cookieOptions, hashToken } from '@/lib/auth';
import { destroySession } from '@/pgdb/queries/auth';

// POST /api/auth/logout -> deletes the session row and clears the cookie
export const POST = handlePublic(async (req) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(hashToken(token));
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return res;
});
