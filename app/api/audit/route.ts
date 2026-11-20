import { ADMIN_ONLY, handle, json } from '@/lib/api';
import { qLimit, qOneOf } from '@/lib/validate';
import { auditLog } from '@/pgdb/queries/bank';

const TABLES = ['account', 'customer', 'loan', 'transactions', 'app_user'] as const;
const OPERATIONS = ['INSERT', 'UPDATE', 'DELETE', 'ALERT'] as const;

// GET /api/audit?table=account&operation=UPDATE&limit=50   (admin only)
export const GET = handle(async (req) => {
  const sp = req.nextUrl.searchParams;
  return json(await auditLog(qOneOf(sp, 'table', TABLES), qOneOf(sp, 'operation', OPERATIONS), qLimit(sp, 50)));
}, ADMIN_ONLY);
