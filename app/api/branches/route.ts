import { ANY, handle, json } from '@/lib/api';
import { listBranches } from '@/pgdb/queries/bank';

export const GET = handle(async () => json(await listBranches()), ANY);
