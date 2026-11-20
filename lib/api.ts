import { NextRequest, NextResponse, connection } from 'next/server';
import { requestUser } from '@/pgdb/client';
import { getSessionUser } from './auth';
import type { Role, SessionUser } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Who may call an endpoint. Default for every route is STAFF (safe by default).
export const STAFF: readonly Role[] = ['ADMIN', 'STAFF'];
export const ADMIN_ONLY: readonly Role[] = ['ADMIN'];
export const ANY: readonly Role[] = ['ADMIN', 'STAFF', 'CUSTOMER'];

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Throw 404 if a query returned nothing. */
export function found<T>(row: T | null | undefined, what: string): T {
  if (row == null) throw new ApiError(404, `${what} not found`);
  return row;
}

// Friendly messages for known unique constraints
const UNIQUE_MESSAGES: Record<string, string> = {
  customer_email_key: 'A customer with this email already exists',
  customer_phone_key: 'A customer with this phone number already exists',
  app_user_username_key: 'That username is already taken',
  app_user_customer_id_key: 'This customer already has a login',
  app_user_employee_id_key: 'This employee already has a login',
};

/** Translate PostgreSQL error codes into clean HTTP errors. */
function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof ApiError) return { status: err.status, message: err.message };

  const e = err as { code?: string; message?: string; detail?: string; constraint?: string };
  switch (e.code) {
    case 'P0001': // RAISE EXCEPTION inside our functions/triggers (insufficient funds, frozen...)
      return { status: 400, message: e.message ?? 'Operation rejected' };
    case '23505': // unique_violation
      return { status: 409, message: UNIQUE_MESSAGES[e.constraint ?? ''] ?? `Already exists (${e.constraint ?? 'duplicate value'})` };
    case '23503': // foreign_key_violation
      return {
        status: 409,
        message: e.detail?.includes('is not present')
          ? 'Referenced record does not exist'
          : 'Record is still referenced by other records',
      };
    case '23514': // check_violation
      return { status: 400, message: `Value rejected by rule: ${e.constraint ?? 'check constraint'}` };
    case '22P02': // invalid_text_representation
    case '22003': // numeric_value_out_of_range
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return { status: 400, message: 'Invalid input value' };
  }
  console.error(err);
  return { status: 500, message: 'Internal server error' };
}

const fail = (err: unknown) => {
  const { status, message } = toHttpError(err);
  return NextResponse.json({ error: message }, { status });
};

async function authorize(req: NextRequest, roles: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError(401, 'Please sign in');
  if (!roles.includes(user.role)) throw new ApiError(403, 'You do not have permission to do this');
  return user;
}

/** Route without a login requirement (only the login/logout endpoints). */
export function handlePublic(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    await connection(); // request-time only: never pre-render API routes at build
    try {
      return await fn(req);
    } catch (err) {
      return fail(err);
    }
  };
}

/** Wrap a route handler without URL params. Checks login + role first. */
export function handle(
  fn: (req: NextRequest, user: SessionUser) => Promise<NextResponse>,
  roles: readonly Role[] = STAFF
) {
  return async (req: NextRequest) => {
    await connection();
    try {
      const user = await authorize(req, roles);
      // everything inside runs "as" this user (audit trail records the username)
      return await requestUser.run(user.username, () => fn(req, user));
    } catch (err) {
      return fail(err);
    }
  };
}

/** Wrap a route handler under a [id] folder. */
export function handleWithId(
  fn: (req: NextRequest, id: number, user: SessionUser) => Promise<NextResponse>,
  roles: readonly Role[] = STAFF
) {
  return async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await connection();
    try {
      const user = await authorize(req, roles);
      const { id } = await ctx.params;
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'Invalid id');
      return await requestUser.run(user.username, () => fn(req, n, user));
    } catch (err) {
      return fail(err);
    }
  };
}
