import { handle, json } from '@/lib/api';
import { optStr, qStr, readBody, reqDate, reqEmail, reqPhone, reqStr } from '@/lib/validate';
import { createCustomer, listCustomers } from '@/pgdb/queries/bank';

// GET /api/customers?search=rahul
export const GET = handle(async (req) => json(await listCustomers(qStr(req.nextUrl.searchParams, 'search'))));

// POST /api/customers  { fullName, email, phone, dob, address? }
export const POST = handle(async (req) => {
  const b = await readBody(req);
  const row = await createCustomer({
    fullName: reqStr(b, 'fullName', 100),
    email: reqEmail(b, 'email'),
    phone: reqPhone(b, 'phone'),
    dob: reqDate(b, 'dob'),
    address: optStr(b, 'address'),
  });
  return json(row, 201);
});
