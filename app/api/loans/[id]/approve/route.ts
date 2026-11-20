import { ADMIN_ONLY, handleWithId, json } from '@/lib/api';
import { approveLoan } from '@/pgdb/queries/bank';

// POST /api/loans/1/approve -> credits the principal to the loan account (admin only)
export const POST = handleWithId(async (_req, id) => json(await approveLoan(id)), ADMIN_ONLY);
