import { handleWithId, json } from '@/lib/api';
import { payEmi } from '@/pgdb/queries/bank';

// POST /api/loans/1/pay -> debits one EMI from the loan account; auto-closes after the last EMI
export const POST = handleWithId(async (_req, id) => json(await payEmi(id)));
