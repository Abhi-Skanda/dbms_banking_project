import { handle, json } from '@/lib/api';
import { qInt } from '@/lib/validate';
import { listEmployees } from '@/pgdb/queries/bank';

// GET /api/employees?branchId=1
export const GET = handle(async (req) => json(await listEmployees(qInt(req.nextUrl.searchParams, 'branchId'))));
