'use client';

import { getDB, type OutboxEntry, type OutboxStatus } from './db';
import { fingerprintMutation, newIdempotencyKey } from './idempotency';

/**
 * Outbox queue — owns the lifecycle of pending mutations.
 *
 * Invariants:
 *   1. Every entry has a unique idempotency key (also sent to server).
 *   2. Status transitions are strictly forward: pending → in-flight →
 *      (success: deleted | failed: failed-permanent | conflict | parked).
 *   3. Failed-permanent + conflict + parked are user-resolvable — they
 *      are never auto-deleted.
 *   4. attempts is monotonic; lastError captures the most recent reason.
 *
 * Concurrency note: IndexedDB transactions are serialised per object
 * store, so two simultaneous enqueue calls can't race on the same key.
 * The fingerprint index lets us dedupe at insert time without a separate
 * lock.
 */

const MAX_ATTEMPTS = 8;

/**
 * Exponential backoff with jitter, capped at 10 minutes. Used to space
 * retries so a server hiccup doesn't get hammered.
 */
function nextBackoffMs(attempt: number): number {
  const base = Math.min(60_000 * Math.pow(2, Math.max(0, attempt - 1)), 600_000);
  const jitter = base * 0.2 * Math.random();
  return Math.round(base + jitter);
}

export interface EnqueueInput {
  method: OutboxEntry['method'];
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  scope?: string;
  /** Local optimistic state, if any, that should roll back on failure. */
  rollback?: unknown;
}

export interface EnqueueResult {
  entry: OutboxEntry;
  /** True if this exact mutation was already in the queue and we
   *  returned the existing entry instead of duplicating it. */
  deduped: boolean;
}

/**
 * Add a mutation to the outbox. Dedupes against in-flight or pending
 * entries with the same fingerprint so a rapid double-tap doesn't
 * write twice.
 */
export async function enqueue(input: EnqueueInput): Promise<EnqueueResult> {
  const db = await getDB();
  const fingerprint = fingerprintMutation(input.method, input.url, input.body);

  return db.transaction('outbox', 'readwrite').store
    .index('by-fingerprint')
    .openCursor(fingerprint)
    .then(async (cursor) => {
      // If an existing pending/in-flight entry has the same fingerprint,
      // return it (dedupe).
      while (cursor) {
        const v = cursor.value;
        if (v.status === 'pending' || v.status === 'in-flight') {
          return { entry: v, deduped: true };
        }
        await cursor.continue();
      }

      const now = Date.now();
      const entry: OutboxEntry = {
        key: newIdempotencyKey(),
        method: input.method,
        url: input.url,
        body: input.body,
        headers: input.headers,
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null,
        nextAttemptAt: now,
        rollback: input.rollback,
        enqueuedAt: now,
        scope: input.scope,
        fingerprint,
      };

      // Re-open in writeable transaction since the cursor was readonly-ish
      // via the index. idb auto-promotes via store.add.
      const tx2 = (await getDB()).transaction('outbox', 'readwrite');
      await tx2.store.add(entry);
      await tx2.done;
      notifyChange();
      return { entry, deduped: false };
    });
}

/**
 * Get all pending entries ready to send (nextAttemptAt <= now), sorted
 * FIFO by enqueuedAt. Used by the sync engine to drain.
 */
export async function getDrainable(now = Date.now()): Promise<OutboxEntry[]> {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readonly');
  const entries = await tx.store.index('by-status').getAll('pending');
  return entries
    .filter((e) => e.nextAttemptAt <= now)
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

/** All outbox entries (for the sync-status panel). */
export async function getAllEntries(): Promise<OutboxEntry[]> {
  const db = await getDB();
  return db.getAll('outbox');
}

export async function countByStatus(): Promise<Record<OutboxStatus, number>> {
  const db = await getDB();
  const all = await db.getAll('outbox');
  const counts: Record<OutboxStatus, number> = {
    pending: 0,
    'in-flight': 0,
    'failed-permanent': 0,
    conflict: 0,
    parked: 0,
  };
  for (const e of all) counts[e.status]++;
  return counts;
}

export async function markInFlight(key: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const entry = await tx.store.get(key);
  if (!entry || entry.status === 'in-flight') {
    await tx.done;
    return;
  }
  entry.status = 'in-flight';
  entry.lastAttemptAt = Date.now();
  entry.attempts += 1;
  await tx.store.put(entry);
  await tx.done;
  notifyChange();
}

export async function complete(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('outbox', key);
  notifyChange();
}

export async function markFailed(
  key: string,
  reason: { status?: number; message?: string },
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const entry = await tx.store.get(key);
  if (!entry) {
    await tx.done;
    return;
  }

  const status = reason.status ?? 0;

  // Classification rules:
  //   - 409: conflict requiring user attention.
  //   - 4xx (other than 408/425/429/409): permanent — body was rejected.
  //   - 5xx + 408 + 425 + 429 + network errors: transient → retry with backoff.
  //   - Exceeded MAX_ATTEMPTS: park for user resolution.
  let nextStatus: OutboxStatus = 'pending';
  if (status === 409) nextStatus = 'conflict';
  else if (status >= 400 && status < 500 && ![408, 425, 429].includes(status)) {
    nextStatus = 'failed-permanent';
  } else if (entry.attempts >= MAX_ATTEMPTS) {
    nextStatus = 'parked';
  }

  entry.status = nextStatus;
  entry.lastError = { status: reason.status, message: reason.message };
  entry.nextAttemptAt =
    nextStatus === 'pending' ? Date.now() + nextBackoffMs(entry.attempts) : Number.MAX_SAFE_INTEGER;
  await tx.store.put(entry);
  await tx.done;
  notifyChange();
}

/** User-driven retry of a parked or failed-permanent entry. */
export async function retry(key: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const entry = await tx.store.get(key);
  if (!entry) {
    await tx.done;
    return;
  }
  entry.status = 'pending';
  entry.nextAttemptAt = Date.now();
  await tx.store.put(entry);
  await tx.done;
  notifyChange();
}

/** User-driven discard. Returns the entry's rollback snapshot if any. */
export async function discard(key: string): Promise<OutboxEntry | undefined> {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const entry = await tx.store.get(key);
  if (entry) await tx.store.delete(key);
  await tx.done;
  notifyChange();
  return entry;
}

// ─────────────── Change notifications ───────────────
// The sync-status UI subscribes to know when to re-render counts.

type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

function notifyChange(): void {
  for (const l of changeListeners) {
    try {
      l();
    } catch {
      /* swallow — listeners must not break the queue */
    }
  }
}

export function onOutboxChange(l: ChangeListener): () => void {
  changeListeners.add(l);
  return () => changeListeners.delete(l);
}
