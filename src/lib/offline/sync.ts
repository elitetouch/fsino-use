'use client';

import axios, { AxiosError } from 'axios';
import { complete, getDrainable, markFailed, markInFlight, onOutboxChange } from './queue';
import { onNetworkChange, isOnline } from './network';
import { setMeta } from './db';

/**
 * Sync engine — drains the outbox in FIFO order whenever:
 *   - the user transitions back online
 *   - an entry is enqueued while online
 *   - a periodic interval ticks (failsafe)
 *   - the service worker fires a 'sync' event (Chrome only)
 *
 * Single-flight: only one drain runs at a time per tab. If a drain is
 * triggered while one is in progress, it's coalesced — we set a "dirty"
 * flag and re-run after the current pass.
 *
 * Tab coordination: the BroadcastChannel API tells other open tabs
 * that we're draining so they don't race. If BroadcastChannel is
 * unavailable (Safari < 15.4), we fall back to a localStorage
 * heartbeat lock with a TTL.
 */

const SYNC_INTERVAL_MS = 60_000;
const SYNC_LOCK_KEY = 'fsm.sync.lock';
const SYNC_LOCK_TTL_MS = 30_000;

let draining = false;
let dirty = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let bc: BroadcastChannel | null = null;

const drainListeners = new Set<() => void>();

export function onDrainTick(l: () => void): () => void {
  drainListeners.add(l);
  return () => drainListeners.delete(l);
}

function notifyTick() {
  for (const l of drainListeners) {
    try { l(); } catch { /* swallow */ }
  }
}

/**
 * Acquire a tab-level lock so multiple tabs don't simultaneously drain
 * the same entries (which would still be safe due to idempotency keys,
 * but wastes bandwidth and causes UI flicker).
 */
function acquireLock(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(SYNC_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { tabId: string; expiresAt: number };
      if (parsed.expiresAt > Date.now() && parsed.tabId !== TAB_ID) {
        return false;
      }
    }
    window.localStorage.setItem(
      SYNC_LOCK_KEY,
      JSON.stringify({ tabId: TAB_ID, expiresAt: Date.now() + SYNC_LOCK_TTL_MS }),
    );
    return true;
  } catch {
    return true; // fall through gracefully if storage is unavailable
  }
}

function releaseLock(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SYNC_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { tabId: string };
      if (parsed.tabId === TAB_ID) {
        window.localStorage.removeItem(SYNC_LOCK_KEY);
      }
    }
  } catch {
    /* no-op */
  }
}

const TAB_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;

/**
 * Drive a single drain pass. Returns the count of successfully sent
 * entries.
 */
export async function drain(): Promise<number> {
  if (!isOnline()) {
    return 0;
  }
  if (draining) {
    dirty = true;
    return 0;
  }
  if (!acquireLock()) return 0;
  draining = true;
  let sent = 0;
  try {
    const entries = await getDrainable();
    for (const entry of entries) {
      // Refresh the lock heartbeat on each iteration so a slow drain
      // doesn't appear stale to other tabs.
      acquireLock();

      await markInFlight(entry.key);
      try {
        const headers = {
          ...(entry.headers ?? {}),
          // Server-side idempotency support — endpoint should dedupe by
          // this header (or by the _idempotencyKey in the body).
          'Idempotency-Key': entry.key,
        };
        const body =
          entry.body && typeof entry.body === 'object' && !Array.isArray(entry.body)
            ? { ...(entry.body as Record<string, unknown>), _idempotencyKey: entry.key }
            : entry.body;
        await axios.request({
          url: entry.url,
          method: entry.method,
          data: body,
          headers,
          timeout: 25_000,
        });
        await complete(entry.key);
        sent++;
      } catch (err) {
        const ax = err as AxiosError;
        await markFailed(entry.key, {
          status: ax.response?.status,
          message:
            (ax.response?.data as { message?: string } | undefined)?.message ??
            ax.message ??
            'Unknown error',
        });
      }
    }
    await setMeta('lastDrainAt', Date.now());
    notifyTick();
    return sent;
  } finally {
    draining = false;
    releaseLock();
    if (dirty) {
      dirty = false;
      // Re-run after a microtask so callers see the first drain finish.
      queueMicrotask(() => { void drain(); });
    }
  }
}

/**
 * Start the sync engine. Idempotent — calling twice is fine.
 */
export function startSync(): void {
  if (typeof window === 'undefined') return;
  if (intervalId) return; // already running

  // Drain whenever we come back online.
  onNetworkChange((online) => {
    if (online) { void drain(); }
  });

  // Drain whenever the outbox changes (a new entry was enqueued).
  onOutboxChange(() => {
    if (isOnline()) { void drain(); }
  });

  // Periodic failsafe — covers cases where event-driven drains missed.
  intervalId = setInterval(() => {
    if (isOnline()) { void drain(); }
  }, SYNC_INTERVAL_MS);

  // Cross-tab notification — when another tab finishes a drain, refresh
  // our UI counts.
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel('fsm-sync');
    bc.onmessage = (e) => {
      if (e.data === 'drained') notifyTick();
    };
    onOutboxChange(() => bc?.postMessage('drained'));
  }

  // Service worker message: BG sync fired in Chrome.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'FSM_DRAIN_OUTBOX') {
        void drain();
      }
    });
  }

  // Drain on tab focus — covers iOS where bg sync isn't available.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOnline()) {
      void drain();
    }
  });

  // First-tick drain in case there are entries from a previous session.
  if (isOnline()) { void drain(); }
}

/** Stop the engine. Used for tests and on logout. */
export function stopSync(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  bc?.close();
  bc = null;
}
