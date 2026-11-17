import { handle, json } from '@/lib/api';
import { monthlyVolume } from '@/pgdb/queries/bank';

export const GET = handle(async () => json(await monthlyVolume()));
