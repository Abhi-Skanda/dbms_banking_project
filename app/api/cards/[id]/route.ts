import { ANY, ApiError, found, handleWithId, json } from '@/lib/api';
import { assertOwner } from '@/lib/guards';
import { CARD_STATUSES, oneOf, readBody } from '@/lib/validate';
import { cardOwnerId, setCardStatus } from '@/pgdb/queries/bank';

// PATCH /api/cards/1  { status }   customers may BLOCK their own card; staff can do anything
export const PATCH = handleWithId(async (req, id, user) => {
  const status = oneOf(await readBody(req), 'status', CARD_STATUSES);
  if (user.role === 'CUSTOMER') {
    assertOwner(user, await cardOwnerId(id), 'card');
    if (status !== 'BLOCKED') throw new ApiError(403, 'You can block your card; only staff can unblock it');
  }
  return json(found(await setCardStatus(id, status), 'Card'));
}, ANY);
