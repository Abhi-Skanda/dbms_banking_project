import { handle, json } from '@/lib/api';
import { qLimit, qOneOf } from '@/lib/validate';
import { auditLog } from '@/pgdb/queries/bank';

const TABLES = ['account', 'customer', 'loan', 'transactions'] as const;
const OPERATIONS = ['INSERT', 'UPDATE', 'DELETE', 'ALERT'] as const;

// GET /api/audit?table=account&operation=UPDATE&limit=50   (operation=ALERT shows high-value alerts)
export const GET = handle(async (req) => {
  const sp = req.nextUrl.searchParams;
  return json(await auditLog(qOneOf(sp, 'table', TABLES), qOneOf(sp, 'operation', OPERATIONS), qLimit(sp, 50)));
});
