import { ApiError } from './api';
import type { SessionUser } from './types';

/**
 * Staff/admin may touch any record. A customer may only touch records they own.
 * Pass the owner's customer_id (null if the record doesn't exist -> customers get 403).
 */
export function assertOwner(user: SessionUser, ownerCustomerId: number | null, what = 'record') {
  if (user.role !== 'CUSTOMER') return;
  if (ownerCustomerId == null || ownerCustomerId !== user.customerId) {
    throw new ApiError(403, `This ${what} does not belong to you`);
  }
}
