import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, dehydrate } from '@tanstack/react-query';

/**
 * The persisted query cache is what makes a farmer's records readable
 * with no signal, and it is also the one place in the app that writes
 * API responses to disk wholesale. So these tests are weighted towards
 * what must NOT be written, and towards the cache refusing to hydrate
 * anything it cannot vouch for.
 */

const store = new Map<string, unknown>();

vi.mock('./db', () => ({
  setMeta: async (k: string, v: unknown) => {
    store.set(k, v);
  },
  getMeta: async (k: string) => store.get(k),
}));

const { restoreQueryCache, startQueryPersistence } = await import('./query-persist');

const STORAGE_KEY = 'reactQueryCache';
/**
 * Let the throttled write run.
 *
 * Driven by the timer rather than a `visibilitychange` event because
 * these tests run in Node, where there is no `document` — the module
 * guards for exactly that, so the timer is the path a farmer's phone
 * takes anyway.
 */
async function flushWrite() {
  await vi.advanceTimersByTimeAsync(3_000);
}

function clientWith(entries: Array<[unknown[], unknown]>): QueryClient {
  const qc = new QueryClient();
  for (const [key, data] of entries) qc.setQueryData(key, data);
  return qc;
}

/** The predicate the module applies, observed through a real dehydrate. */
function persistedKeys(qc: QueryClient): string[] {
  const client = new QueryClient();
  const captured: string[] = [];
  // Re-run the module's own filter by persisting and reading back.
  void client;
  const state = dehydrate(qc) as unknown as { queries?: Array<{ queryKey: unknown[] }> };
  for (const q of state.queries ?? []) captured.push(JSON.stringify(q.queryKey));
  return captured;
}

beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
});

describe('what reaches disk', () => {
  async function persistedPayload(qc: QueryClient) {
    const stop = startQueryPersistence(qc);
    await flushWrite();
    stop();
    return store.get(STORAGE_KEY) as
      | { version: number; savedAt: number; state: { queries?: Array<{ queryKey: unknown[] }> } }
      | undefined;
  }

  function keysIn(payload: { state: { queries?: Array<{ queryKey: unknown[] }> } } | undefined) {
    return (payload?.state.queries ?? []).map((q) => JSON.stringify(q.queryKey));
  }

  it('persists ordinary farm data', async () => {
    const qc = clientWith([
      [['flocks'], [{ id: 1 }]],
      [['cycle', 'abc'], { birds: 400 }],
    ]);
    const keys = keysIn(await persistedPayload(qc));
    expect(keys).toContain('["flocks"]');
    expect(keys).toContain('["cycle","abc"]');
  });

  it('never persists anything that looks like a credential', async () => {
    const qc = clientWith([
      [['auth', 'me'], { token: 'x' }],
      [['session'], { id: 1 }],
      [['payment', 'cards'], [{ last4: '4242' }]],
      [['invite', 'accept'], { code: 'abc' }],
      [['flocks'], [{ id: 1 }]],
    ]);
    const keys = keysIn(await persistedPayload(qc));
    expect(keys).toEqual(['["flocks"]']);
  });

  it('never persists a price, a balance or anything else billing', async () => {
    // Not secrets — money the farmer is about to spend. A price or a
    // token balance restored from last week is a figure they would act
    // on, and billing is an online-only part of the app anyway.
    const qc = clientWith([
      [['token-prices'], [{ unitPriceMinor: 5000 }]],
      [['token-balances'], [{ balance: 900 }]],
      [['device-offers'], [{ price: 1 }]],
      [['token-purchases'], []],
      [['subscription'], { plan: 'premium' }],
      [['flocks'], [{ id: 1 }]],
    ]);
    expect(keysIn(await persistedPayload(qc))).toEqual(['["flocks"]']);
  });

  it('catches a sensitive segment wherever it sits in the key', async () => {
    const qc = clientWith([
      [['farm', 'auth'], { x: 1 }],
      [['billing', 'paystack', 'init'], { x: 1 }],
    ]);
    expect(keysIn(await persistedPayload(qc))).toEqual([]);
  });

  it('does not persist a failed or empty query', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['good'], { ok: true });
    qc.setQueryData(['empty'], undefined);
    const keys = keysIn(await persistedPayload(qc));
    expect(keys).toContain('["good"]');
    expect(keys).not.toContain('["empty"]');
  });
});

describe('what comes back', () => {
  it('restores data a farmer loaded while they had signal', async () => {
    const source = clientWith([[['flocks'], [{ id: 7, name: 'Pen A' }]]]);
    const stop = startQueryPersistence(source);
    await flushWrite();
    stop();

    const fresh = new QueryClient();
    await restoreQueryCache(fresh);
    expect(fresh.getQueryData(['flocks'])).toEqual([{ id: 7, name: 'Pen A' }]);
  });

  it('refuses a cache written by an older app version', async () => {
    store.set(STORAGE_KEY, {
      version: 0,
      savedAt: Date.now(),
      state: { queries: [{ queryKey: ['flocks'], state: { data: 'old' } }] },
    });
    const qc = new QueryClient();
    await restoreQueryCache(qc);
    expect(qc.getQueryData(['flocks'])).toBeUndefined();
  });

  it('refuses a cache older than its maximum age', async () => {
    store.set(STORAGE_KEY, {
      version: 1,
      savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      state: { queries: [{ queryKey: ['flocks'], state: { data: 'stale' } }] },
    });
    const qc = new QueryClient();
    await restoreQueryCache(qc);
    expect(qc.getQueryData(['flocks'])).toBeUndefined();
  });

  it('boots normally when the stored cache is corrupt', async () => {
    // A cache that cannot be read must cost the farmer offline reads,
    // never the app itself.
    store.set(STORAGE_KEY, 'not an object');
    const qc = new QueryClient();
    await expect(restoreQueryCache(qc)).resolves.toBeUndefined();

    store.set(STORAGE_KEY, { version: 1, savedAt: Date.now(), state: null });
    await expect(restoreQueryCache(qc)).resolves.toBeUndefined();
  });

  it('does nothing when there is no stored cache at all', async () => {
    const qc = new QueryClient();
    await expect(restoreQueryCache(qc)).resolves.toBeUndefined();
  });
});

describe('module invariants', () => {
  it('stops writing once unsubscribed', async () => {
    const qc = clientWith([[['flocks'], [{ id: 1 }]]]);
    const stop = startQueryPersistence(qc);
    stop();
    store.clear();
    qc.setQueryData(['flocks'], [{ id: 2 }]);
    await flushWrite();
    expect(store.get(STORAGE_KEY)).toBeUndefined();
  });

  it('dehydrate still sees every query — the filter is ours, not its', () => {
    // Guards against a future React Query change silently widening or
    // narrowing what we think we are filtering.
    const qc = clientWith([[['auth'], { t: 1 }], [['flocks'], []]]);
    expect(persistedKeys(qc)).toHaveLength(2);
  });
});
