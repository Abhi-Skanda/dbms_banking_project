// Raw-SQL data access for logins, sessions and user management.
import { query } from '../client';
import type { AppUser, Role } from '@/lib/types';

const first = async <T>(p: Promise<T[]>): Promise<T | null> => (await p)[0] ?? null;

export type LoginResult = { user_id: number | null; status: 'OK' | 'INVALID' | 'LOCKED' | 'DISABLED' };

// All password checking and lockout logic lives in the DB function fn_login
export const login = async (username: string, password: string) =>
  (await first<LoginResult>(query(`SELECT * FROM fn_login($1, $2)`, [username, password])))!;

export const createSession = (userId: number, tokenHash: string, hours: number) =>
  query(
    `WITH cleanup AS (DELETE FROM app_session WHERE expires_at < now())
     INSERT INTO app_session (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3::int))`,
    [tokenHash, userId, hours]
  );

export const destroySession = (tokenHash: string) => query(`DELETE FROM app_session WHERE token_hash = $1`, [tokenHash]);

export const changePassword = (userId: number, current: string, next: string, keepHash: string | null) =>
  query(`SELECT fn_change_password($1, $2, $3, $4)`, [userId, current, next, keepHash], true);

// ---- user management (admin) ----------------------------------------
export const listUsers = () =>
  query<AppUser>(
    `SELECT u.user_id, u.username, u.role, COALESCE(c.full_name, e.full_name) AS full_name,
            u.is_active, (u.locked_until IS NOT NULL AND u.locked_until > now()) AS locked,
            u.last_login, u.created_at, u.customer_id, u.employee_id
     FROM app_user u
     LEFT JOIN customer c ON c.customer_id = u.customer_id
     LEFT JOIN employee e ON e.employee_id = u.employee_id
     ORDER BY u.user_id`
  );

export const createUser = (username: string, password: string, role: Role, customerId: number | null, employeeId: number | null) =>
  first<{ user_id: number }>(
    query(`SELECT fn_create_user($1, $2, $3::user_role, $4, $5) AS user_id`, [username, password, role, customerId, employeeId], true)
  );

export const setUserActive = (id: number, active: boolean) =>
  query(`SELECT fn_set_user_active($1, $2)`, [id, active], true);

export const resetPassword = (id: number, password: string) =>
  query(`SELECT fn_set_password($1, $2)`, [id, password], true);
