'use client';

import { getDB, type CacheEntry } from './db';

/**
 * Read-side cache for API GETs.
 *
 * Two timestamps:
 *   - staleAt:  past this point, returned but flagged stale → sync engine
 *               will refresh in the background.
 *   - expiresAt: past this point, evicted on next access.
 *
 * Default TTLs are conservative because farm data changes throughout
 * the day; per-endpoint overrides can be passed via `put()`.
 */

const DEFAULT_STALE_MS = 5 * 60_000;       // 5 minutes
const DEFAULT_EXPIRE_MS = 7 * 24 * 60 * 60_000; // 7 days

export async function put(
  url: string,
  body: unknown,
  opts?: { staleMs?: number; expireMs?: number; etag?: string },
): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  const entry: CacheEntry = {
    url,
    body,
    storedAt: now,
    staleAt: now + (opts?.staleMs ?? DEFAULT_STALE_MS),
    expiresAt: now + (opts?.expireMs ?? DEFAULT_EXPIRE_MS),
    etag: opts?.etag,
  };
  await db.put('cache', entry);
}

export async function get(url: string): Promise<{ body: unknown; stale: boolean } | null> {
  const db = await getDB();
  const entry = await db.get('cache', url);
  if (!entry) return null;
  const now = Date.now();
  if (entry.expiresAt < now) {
    // Hard-expired — evict.
    await db.delete('cache', url);
    return null;
  }
  return { body: entry.body, stale: entry.staleAt < now };
}

export async function clear(): Promise<void> {
  const db = await getDB();
  await db.clear('cache');
}

/** Best-effort cap on cache size — drops oldest entries when over limit. */
export async function enforceLimit(maxEntries = 500): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cache', 'readwrite');
  const index = tx.store.index('by-storedAt');
  const total = await tx.store.count();
  if (total <= maxEntries) {
    await tx.done;
    return;
  }
  const overage = total - maxEntries;
  let removed = 0;
  let cursor = await index.openCursor();
  while (cursor && removed < overage) {
    await cursor.delete();
    removed++;
    cursor = await cursor.continue();
  }
  await tx.done;
}
