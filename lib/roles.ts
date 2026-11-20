// Client-safe role groups (lib/api.ts is server-only, so the UI uses these)
import type { Role } from './types';

export const STAFF_ROLES: Role[] = ['ADMIN', 'STAFF'];
export const ADMIN_ROLES: Role[] = ['ADMIN'];
