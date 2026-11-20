import { ANY, handle, json } from '@/lib/api';
import { CARD_TYPES, oneOf, qInt, readBody, reqInt } from '@/lib/validate';
import { issueCard, listCards } from '@/pgdb/queries/bank';

// GET /api/cards?accountId=1  (numbers are masked; customers see only their own cards)
export const GET = handle(async (req, user) =>
  json(await listCards(qInt(req.nextUrl.searchParams, 'accountId'), user.role === 'CUSTOMER' ? user.customerId : null)), ANY);

// POST /api/cards  { accountId, cardType }   (staff only)
export const POST = handle(async (req) => {
  const b = await readBody(req);
  return json(await issueCard(reqInt(b, 'accountId'), oneOf(b, 'cardType', CARD_TYPES)), 201);
});
