import { handle, json } from '@/lib/api';
import { LOAN_STATUSES, qInt, qOneOf, readBody, reqInt, reqMoney, reqNum } from '@/lib/validate';
import { applyForLoan, listLoans } from '@/pgdb/queries/bank';

// GET /api/loans?status=ACTIVE&customerId=1
export const GET = handle(async (req) => {
  const sp = req.nextUrl.searchParams;
  return json(await listLoans(qOneOf(sp, 'status', LOAN_STATUSES), qInt(sp, 'customerId')));
});

// POST /api/loans  { customerId, accountId, principal, interestRate, tenureMonths }
export const POST = handle(async (req) => {
  const b = await readBody(req);
  const loan = await applyForLoan(
    reqInt(b, 'customerId'), reqInt(b, 'accountId'), reqMoney(b, 'principal'),
    reqNum(b, 'interestRate', 0, 40), reqNum(b, 'tenureMonths', 1, 360)
  );
  return json(loan, 201);
});
