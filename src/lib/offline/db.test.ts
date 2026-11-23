import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * One property, and it is the one whose absence took the app down.
 *
 * `getDB()` must SETTLE. IndexedDB's open request stays pending
 * indefinitely while another tab holds an older version of the
 * database — the `blocked` callback fires but unblocks nothing — and
 * everything awaiting storage waits with it.
 *
 * That was survivable while storage was a side feature. It stopped
 * being survivable when the query-cache restore began gating every
 * React Query fetch: a blocked open meant `usePermissions` never ran,
 * and every gated screen reported "Can't load this page offline yet"
 * on a perfectly good connection.
 */

const openDB = vi.fn();
vi.mock('idb', () => ({ openDB: (...args: unknown[]) => openDB(...args) }));

beforeEach(() => {
  vi.resetModules();
  openDB.mockReset();
  vi.useFakeTimers();
  // The module guards on a browser with IndexedDB available, and the
  // test environment is node.
  vi.stubGlobal('window', { indexedDB: {} });
  vi.stubGlobal('indexedDB', {});
});

async function freshGetDB() {
  const mod = await import('./db');
  return mod.getDB;
}

describe('getDB never hangs', () => {
  it('rejects instead of waiting forever when the open is blocked', async () => {
    openDB.mockReturnValue(new Promise(() => {})); // never settles, like a blocked upgrade
    const getDB = await freshGetDB();

    const result = getDB();
    const assertion = expect(result).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it('does not cache the failure — the next call tries again', async () => {
    // A single bad moment must not disable offline storage for the
    // life of the tab.
    openDB.mockReturnValueOnce(new Promise(() => {}));
    const getDB = await freshGetDB();

    const first = getDB();
    const firstAssertion = expect(first).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5_000);
    await firstAssertion;

    const db = { name: 'reopened' };
    openDB.mockReturnValueOnce(Promise.resolve(db));
    await expect(getDB()).resolves.toBe(db);
  });

  it('resolves normally when the database opens', async () => {
    const db = { name: 'ok' };
    openDB.mockReturnValue(Promise.resolve(db));
    const getDB = await freshGetDB();
    await expect(getDB()).resolves.toBe(db);
  });

  it('reuses one connection rather than opening per call', async () => {
    openDB.mockReturnValue(Promise.resolve({ name: 'ok' }));
    const getDB = await freshGetDB();
    await Promise.all([getDB(), getDB(), getDB()]);
    expect(openDB).toHaveBeenCalledTimes(1);
  });
});
