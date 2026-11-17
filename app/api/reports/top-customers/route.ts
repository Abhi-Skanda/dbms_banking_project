import { handle, json } from '@/lib/api';
import { qLimit } from '@/lib/validate';
import { topCustomers } from '@/pgdb/queries/bank';

// GET /api/reports/top-customers?limit=5
export const GET = handle(async (req) => json(await topCustomers(qLimit(req.nextUrl.searchParams, 5, 50))));
