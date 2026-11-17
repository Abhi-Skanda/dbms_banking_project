import { handle, json } from '@/lib/api';
import { CARD_TYPES, oneOf, qInt, readBody, reqInt } from '@/lib/validate';
import { issueCard, listCards } from '@/pgdb/queries/bank';

// GET /api/cards?accountId=1  (card numbers are masked)
export const GET = handle(async (req) => json(await listCards(qInt(req.nextUrl.searchParams, 'accountId'))));

// POST /api/cards  { accountId, cardType: "DEBIT" | "CREDIT" }
export const POST = handle(async (req) => {
  const b = await readBody(req);
  return json(await issueCard(reqInt(b, 'accountId'), oneOf(b, 'cardType', CARD_TYPES)), 201);
});
