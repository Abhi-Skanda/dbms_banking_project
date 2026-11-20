// Server-only helpers: session cookie + database-backed sessions.
import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { query } from '@/pgdb/client';
import type { SessionUser } from './types';

export const SESSION_COOKIE = 'bank_session';
export const SESSION_HOURS = 8;

export const newToken = () => randomBytes(32).toString('hex');
// Only the hash is stored in the DB, so a leaked table can't be used to log in
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const cookieOptions = {
  httpOnly: true,                                   // JavaScript in the browser can't read it
  sameSite: 'lax' as const,                         // not sent on cross-site POSTs (CSRF protection)
  secure: process.env.COOKIE_SECURE === 'true',     // set COOKIE_SECURE=true when served over HTTPS
  path: '/',
};

/** Who is making this request? null = not signed in (or session expired/revoked). */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await query<SessionUser>(
    `SELECT u.user_id AS "userId", u.username, u.role,
            u.customer_id AS "customerId", u.employee_id AS "employeeId",
            COALESCE(c.full_name, e.full_name, u.username) AS "fullName"
     FROM app_session s
     JOIN app_user u ON u.user_id = s.user_id
     LEFT JOIN customer c ON c.customer_id = u.customer_id
     LEFT JOIN employee e ON e.employee_id = u.employee_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active`,
    [hashToken(token)]
  );
  return rows[0] ?? null;
}
