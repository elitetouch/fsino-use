'use client';

import { getOffline } from './api';
import type { FarmDto } from '@/lib/api';

/**
 * The farms list, served from cache when there is no signal.
 *
 * WHY THIS IS ITS OWN MODULE. This one response decides the farmer's
 * role and permissions, and therefore whether they may open any gated
 * page at all. Fetched over the network alone it fails offline, and a
 * failed permissions lookup reads exactly like "no permission" —
 * which is how an app that queues records offline ended up refusing
 * access to the screens that write them.
 *
 * Cached for a week. Memberships change rarely, and a stale role is
 * incomparably better than a lockout: the server enforces permissions
 * on every write regardless, so the worst a stale cache can do is show
 * someone a screen whose save the API then refuses. The reverse — a
 * farmer with a full outbox staring at "You don't have access" in a
 * shed with no signal — is the failure that actually costs them.
 */
const STALE_MS = 60_000;
const EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export async function listFarmsOffline(): Promise<{ farms: FarmDto[] }> {
  const res = await getOffline<{ data?: { farms?: FarmDto[] }; farms?: FarmDto[] }>(
    '/farms',
    { staleMs: STALE_MS, expireMs: EXPIRE_MS },
  );

  // The API wraps bodies in `data`; the cache stores whatever was
  // returned, so both shapes are unwrapped defensively rather than
  // assumed.
  const farms = res.data?.data?.farms ?? res.data?.farms;
  return { farms: Array.isArray(farms) ? farms : [] };
}
