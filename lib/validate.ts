import { NextRequest } from 'next/server';
import { ApiError } from './api';

export type Body = Record<string, unknown>;

const bad = (msg: string): never => {
  throw new ApiError(400, msg);
};

function parseObject(text: string): Body {
  let b: unknown;
  try {
    b = JSON.parse(text);
  } catch {
    return bad('Body must be valid JSON');
  }
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return bad('Body must be a JSON object');
  return b as Body;
}

export async function readBody(req: NextRequest): Promise<Body> {
  return parseObject(await req.text());
}

/** Like readBody, but an empty body is allowed. */
export async function readOptionalBody(req: NextRequest): Promise<Body> {
  const text = await req.text();
  return text.trim() ? parseObject(text) : {};
}

/** Use for PATCH/PUT: returns null when the field is absent. */
export const opt = <T>(b: Body, k: string, fn: (b: Body, k: string) => T): T | null =>
  b[k] === undefined ? null : fn(b, k);

export function reqStr(b: Body, k: string, max = 255): string {
  const v = b[k];
  if (typeof v !== 'string' || v.trim() === '') return bad(`${k} is required`);
  if (v.trim().length > max) return bad(`${k} must be at most ${max} characters`);
  return v.trim();
}

export const optStr = (b: Body, k: string, max = 255): string | null =>
  b[k] == null || b[k] === '' ? null : reqStr(b, k, max);

export function reqInt(b: Body, k: string): number {
  const n = Number(b[k]);
  if (b[k] == null || b[k] === '' || !Number.isInteger(n) || n <= 0) return bad(`${k} must be a positive integer`);
  return n;
}

export function reqNum(b: Body, k: string, min: number, max: number): number {
  const n = Number(b[k]);
  if (b[k] == null || b[k] === '' || !Number.isFinite(n) || n < min || n > max)
    return bad(`${k} must be a number between ${min} and ${max}`);
  return n;
}

/** Positive money amount with at most 2 decimals. */
export function reqMoney(b: Body, k: string): number {
  const n = Number(b[k]);
  if (b[k] == null || b[k] === '' || !Number.isFinite(n) || n <= 0 || Math.round(n * 100) / 100 !== n)
    return bad(`${k} must be a positive amount with at most 2 decimals`);
  return n;
}

export function oneOf<T extends string>(b: Body, k: string, allowed: readonly T[]): T {
  const v = b[k];
  if (typeof v !== 'string' || !allowed.includes(v as T)) return bad(`${k} must be one of: ${allowed.join(', ')}`);
  return v as T;
}

export const optBool = (b: Body, k: string): boolean => {
  if (typeof b[k] !== 'boolean') return bad(`${k} must be true or false`);
  return b[k] as boolean;
};

export function reqEmail(b: Body, k: string): string {
  const v = reqStr(b, k, 120);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : bad(`${k} is not a valid email`);
}

export function reqPhone(b: Body, k: string): string {
  const v = reqStr(b, k, 10);
  return /^[6-9][0-9]{9}$/.test(v) ? v : bad(`${k} must be a 10-digit Indian mobile number`);
}

export function reqDate(b: Body, k: string): string {
  const v = reqStr(b, k, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : bad(`${k} must be YYYY-MM-DD`);
}

// ---- query-string helpers ---------------------------------------------
export function qInt(sp: URLSearchParams, k: string): number | null {
  const v = sp.get(k);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : bad(`${k} must be a positive integer`);
}

export const qStr = (sp: URLSearchParams, k: string): string | null => sp.get(k) || null;

export function qLimit(sp: URLSearchParams, def = 20, max = 200): number {
  const n = qInt(sp, 'limit');
  return n == null ? def : Math.min(n, max);
}

export function qOneOf<T extends string>(sp: URLSearchParams, k: string, allowed: readonly T[]): T | null {
  const v = sp.get(k);
  if (!v) return null;
  return allowed.includes(v as T) ? (v as T) : bad(`${k} must be one of: ${allowed.join(', ')}`);
}

export function qDate(sp: URLSearchParams, k: string): string | null {
  const v = sp.get(k);
  if (!v) return null;
  return Number.isNaN(Date.parse(v)) ? bad(`${k} must be a valid date`) : v;
}

export const ACCOUNT_TYPES = ['SAVINGS', 'CURRENT'] as const;
export const ACCOUNT_STATUSES = ['ACTIVE', 'FROZEN', 'CLOSED'] as const;
export const CARD_TYPES = ['DEBIT', 'CREDIT'] as const;
export const CARD_STATUSES = ['ACTIVE', 'BLOCKED', 'EXPIRED'] as const;
export const LOAN_STATUSES = ['PENDING', 'ACTIVE', 'CLOSED', 'REJECTED'] as const;
