import { handle, json } from '@/lib/api';
import { branchSummary } from '@/pgdb/queries/bank';

export const GET = handle(async () => json(await branchSummary()));
