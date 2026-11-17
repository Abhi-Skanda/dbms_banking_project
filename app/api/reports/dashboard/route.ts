import { handle, json } from '@/lib/api';
import { dashboardStats } from '@/pgdb/queries/bank';

export const GET = handle(async () => json(await dashboardStats()));
