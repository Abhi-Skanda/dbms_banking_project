import { ANY, handle, json } from '@/lib/api';

// GET /api/auth/me -> the signed-in user (401 if not signed in)
export const GET = handle(async (_req, user) => json(user), ANY);
