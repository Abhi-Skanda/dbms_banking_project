import { ANY, handle, json } from '@/lib/api';
import { LOAN_STATUSES, qInt, qOneOf, readBody, reqInt, reqMoney, reqNum } from '@/lib/validate';
import { applyForLoan, listLoans } from '@/pgdb/queries/bank';

// GET /api/loans?status=ACTIVE&customerId=1   (customers: only their own loans)
export const GET = handle(async (req, user) => {
  const sp = req.nextUrl.searchParams;
  const customerId = user.role === 'CUSTOMER' ? user.customerId : qInt(sp, 'customerId');
  return json(await listLoans(qOneOf(sp, 'status', LOAN_STATUSES), customerId));
}, ANY);

// POST /api/loans  { customerId?, accountId, principal, interestRate, tenureMonths }
// Customers apply for themselves (customerId is taken from the login); the DB checks account ownership.
export const POST = handle(async (req, user) => {
  const b = await readBody(req);
  const customerId = user.role === 'CUSTOMER' ? user.customerId! : reqInt(b, 'customerId');
  const loan = await applyForLoan(
    customerId, reqInt(b, 'accountId'), reqMoney(b, 'principal'),
    reqNum(b, 'interestRate', 0, 40), reqNum(b, 'tenureMonths', 1, 360)
  );
  return json(loan, 201);
}, ANY);
