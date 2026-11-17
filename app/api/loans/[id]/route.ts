import { found, handleWithId, json } from '@/lib/api';
import { getLoan } from '@/pgdb/queries/bank';

// GET /api/loans/1 -> loan + progress + payment history
export const GET = handleWithId(async (_req, id) => json(found(await getLoan(id), 'Loan')));
