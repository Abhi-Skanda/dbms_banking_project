import { found, handleWithId, json } from '@/lib/api';
import { CARD_STATUSES, oneOf, readBody } from '@/lib/validate';
import { setCardStatus } from '@/pgdb/queries/bank';

// PATCH /api/cards/1  { status: "ACTIVE" | "BLOCKED" | "EXPIRED" }
export const PATCH = handleWithId(async (req, id) => {
  const b = await readBody(req);
  return json(found(await setCardStatus(id, oneOf(b, 'status', CARD_STATUSES)), 'Card'));
});
