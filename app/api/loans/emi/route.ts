import { handle, json } from '@/lib/api';
import { reqMoney, reqNum } from '@/lib/validate';
import { calculateEmi } from '@/pgdb/queries/bank';

// GET /api/loans/emi?principal=500000&rate=9.5&months=24  (runs fn_calculate_emi in the DB)
export const GET = handle(async (req) => {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const principal = reqMoney(q, 'principal');
  const rate = reqNum(q, 'rate', 0, 40);
  const months = reqNum(q, 'months', 1, 360);
  const row = await calculateEmi(principal, rate, Math.floor(months));
  return json({ principal, rate, months, ...row });
});
