import { NextRequest, NextResponse, connection } from 'next/server';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Throw 404 if a query returned nothing. */
export function found<T>(row: T | null | undefined, what: string): T {
  if (row == null) throw new ApiError(404, `${what} not found`);
  return row;
}

/** Translate PostgreSQL error codes into clean HTTP errors. */
function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof ApiError) return { status: err.status, message: err.message };

  const e = err as { code?: string; message?: string; detail?: string; constraint?: string };
  switch (e.code) {
    case 'P0001': // RAISE EXCEPTION inside our functions/triggers (insufficient funds, frozen...)
      return { status: 400, message: e.message ?? 'Operation rejected' };
    case '23505': // unique_violation
      return { status: 409, message: `Already exists (${e.constraint ?? 'duplicate value'})` };
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

/** Wrap a route handler without URL params. */
export function handle(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    await connection(); // request-time only: never pre-render API routes at build
    try {
      return await fn(req);
    } catch (err) {
      return fail(err);
    }
  };
}

/** Wrap a route handler under a [id] folder. */
export function handleWithId(fn: (req: NextRequest, id: number) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await connection();
    try {
      const { id } = await ctx.params;
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'Invalid id');
      return await fn(req, n);
    } catch (err) {
      return fail(err);
    }
  };
}
