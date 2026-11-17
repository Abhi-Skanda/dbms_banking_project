import { found, handleWithId, json } from '@/lib/api';
import { rejectLoan } from '@/pgdb/queries/bank';

export const POST = handleWithId(async (_req, id) => json(found(await rejectLoan(id), 'Loan')));
