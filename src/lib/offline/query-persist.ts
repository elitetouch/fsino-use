'use client';

import { dehydrate, hydrate, type QueryClient, type Query } from '@tanstack/react-query';
import { getMeta, setMeta } from './db';

/**
 * Persist the React Query cache to IndexedDB, and put it back on boot.
 *
 * WHY THIS EXISTS. The service worker caches the app — its HTML, its
 * JavaScript, its CSS — and once that worked the app booted offline
 * and then had nothing to show. Every screen reported "can't load this
 * page offline yet", because the shell and the data are two different
 * problems and only one of them had been solved.
 *
 * The app makes 71 reads through `useQuery`. Exactly two of them went
 * through the offline read-cache: the farms list and the learned
 * vocabulary. The other sixty-nine went straight to the network, so
 * with no signal they failed, and a farmer looking at their flock
 * saw an error where their birds should be.
 *
 * Routing sixty-nine call sites through a different fetcher would be a
 * large and error-prone change, and every new query added afterwards
 * would be offline-broken by default until someone remembered. So the
 * cache is persisted underneath them instead: every query the farmer
 * has loaded once with signal is on the device, and every query added
 * later gets the same treatment without being asked to.
 *
 * WHAT IS NOT PERSISTED. Only successful queries, and nothing whose key
 * is named in DO_NOT_PERSIST. A farmer's phone is shared, lost and
 * sold, so anything that is a credential or a payment instrument stays
 * in memory where closing the tab is enough to be rid of it. Farm
 * records are already stored on the device by design — that is what
 * the outbox is — so they are not the concern here.
 */

/** Where the dehydrated cache lives in the `meta` store. */
const STORAGE_KEY = 'reactQueryCache';

/**
 * Bump to discard every persisted cache.
 *
 * Needed when a DTO changes shape: hydrating last week's shape into
 * this week's components is how a farmer gets a crash instead of a
 * stale number.
 */
const SCHEMA_VERSION = 1;

/**
 * How long a persisted cache may be restored for.
 *
 * A week matches the farms cache, and the reasoning is the same: a
 * stale reading clearly marked as stale beats an empty screen in a
 * shed with no signal. Past that the figures are old enough that
 * showing them would be its own kind of wrong.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Query keys that must never reach disk.
 *
 * Matched against every segment of the key, so `['auth', 'me']` and
 * `['me', 'auth']` are both caught. Deliberately a denylist of things
 * that are sensitive rather than an allowlist of things that are not:
 * an allowlist would silently stop persisting any query added later,
 * which is the failure this module exists to prevent.
 */
const DO_NOT_PERSIST: readonly string[] = [
  'auth', 'token', 'tokens', 'session', 'password', 'otp', 'verify',
  'card', 'cards', 'payment', 'paystack', 'flutterwave', 'wallet-pin',
  'invite', 'secret',
  // Billing figures. Not secret — but money the farmer is about to
  // spend, and a price or balance restored from last week is a number
  // they would act on. Billing is an online-only part of the app, so
  // there is nothing lost by making it say so.
  'price', 'prices', 'offer', 'offers', 'purchase', 'purchases',
  'billing', 'subscription', 'balance', 'balances',
];

/** Writes are coalesced — a burst of queries settling is one write. */
const WRITE_THROTTLE_MS = 2_000;

interface PersistedPayload {
  version: number;
  savedAt: number;
  state: unknown;
}

function isPersistable(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  // An error or a fetch in flight is not a fact about the farm.
  if (query.state.data === undefined) return false;

  for (const segment of query.queryKey) {
    if (typeof segment !== 'string') continue;
    const lower = segment.toLowerCase();
    if (DO_NOT_PERSIST.some((banned) => lower === banned || lower.includes(banned))) {
      return false;
    }
  }
  return true;
}

/**
 * Read the cache back from disk.
 *
 * Call before rendering anything that queries, so a farmer who opens
 * the app with no signal sees their records rather than a spinner that
 * resolves into an error.
 */
export async function restoreQueryCache(client: QueryClient): Promise<void> {
  try {
    const stored = await getMeta<PersistedPayload>(STORAGE_KEY);
    if (!stored || typeof stored !== 'object') return;
    if (stored.version !== SCHEMA_VERSION) {
      await setMeta(STORAGE_KEY, undefined);
      return;
    }
    if (!Number.isFinite(stored.savedAt) || Date.now() - stored.savedAt > MAX_AGE_MS) {
      await setMeta(STORAGE_KEY, undefined);
      return;
    }
    hydrate(client, stored.state);
  } catch {
    // A corrupt or unreadable cache must not stop the app booting. The
    // farmer loses offline reads for this session, which is exactly
    // where they were before this module existed.
  }
}

/**
 * Start writing the cache to disk as it changes.
 *
 * Returns an unsubscribe function.
 */
export function startQueryPersistence(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const write = async () => {
    timer = null;
    if (stopped) return;
    try {
      const state = dehydrate(client, { shouldDehydrateQuery: isPersistable });
      await setMeta(STORAGE_KEY, {
        version: SCHEMA_VERSION,
        savedAt: Date.now(),
        state,
      } satisfies PersistedPayload);
    } catch {
      // Out of quota, private mode, or storage blocked. Nothing here is
      // worth an error on screen — the app works, it just will not
      // remember this session.
    }
  };

  const schedule = () => {
    if (stopped || timer !== null) return;
    timer = setTimeout(() => void write(), WRITE_THROTTLE_MS);
  };

  const unsubscribe = client.getQueryCache().subscribe(schedule);

  // Schedule one write immediately, rather than waiting for the next
  // cache event. A query that settled before this subscription was
  // attached — an instant cache hit on boot, say — would otherwise sit
  // unwritten until something else happened to change, and on a screen
  // the farmer opens and leaves alone nothing else ever does.
  schedule();

  // The throttle means the last few seconds of a session would
  // otherwise be lost — including, on a phone, the moment the farmer
  // switches away from the browser.
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    void write();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', flush);
  }

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', flush);
    }
    unsubscribe();
  };
}
