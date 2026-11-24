'use client';

/**
 * Current-farm context.
 *
 * The backend's pen/flock/daily-record routes require an X-Farm-ID
 * header (via farm.context middleware). We persist the user's
 * currently-selected farm in localStorage so the header is automatic
 * on every request — flipping farms is a single setter call from a
 * farm-switcher in the topbar.
 */

import { useEffect, useState } from 'react';
import { readUser } from './auth';

/**
 * One key per user, like the last-visited-cycle memory alongside it.
 *
 * It used to be a single global key, which forced sign-out to clear
 * it: on a shared phone the next person would otherwise have inherited
 * the previous one's farm. Clearing it is why signing back in no
 * longer returned a farmer to the farm they had been working in —
 * with nothing stored, the dashboard fell through to `farms[0]`, the
 * most recently created one, which is not where they left off.
 *
 * Scoping by user removes the reason to clear it, so the choice
 * survives a sign-out and two people on one phone keep their own.
 */
const LEGACY_KEY = 'fsm.app.currentFarmId';

function keyFor(userId: string | number | null): string {
  return userId == null ? LEGACY_KEY : `${LEGACY_KEY}:${userId}`;
}

function currentUserId(): string | number | null {
  try {
    return readUser()?.id ?? null;
  } catch {
    return null;
  }
}

const listeners = new Set<(farmId: string | null) => void>();

export function readCurrentFarmId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const userId = currentUserId();
    const clean = (v: string | null) =>
      v && v !== 'null' && v !== 'undefined' ? v : null;

    const own = clean(window.localStorage.getItem(keyFor(userId)));
    if (own) return own;

    // Adopt a selection made before this was scoped per user, so
    // nobody is bounced to another farm by the upgrade itself.
    if (userId != null) {
      const legacy = clean(window.localStorage.getItem(LEGACY_KEY));
      if (legacy) {
        window.localStorage.setItem(keyFor(userId), legacy);
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCurrentFarmId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = keyFor(currentUserId());
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
    for (const l of listeners) {
      try { l(id); } catch { /* ignore */ }
    }
    // Cross-tab sync — other tabs pick this up via the 'storage' event.
  } catch {
    /* ignore */
  }
}

export function onCurrentFarmChange(l: (farmId: string | null) => void): () => void {
  listeners.add(l);
  if (typeof window !== 'undefined') {
    const handler = (e: StorageEvent) => {
      // Only this user's key. Another tab signed in as someone else
      // must not move this tab's farm.
      if (e.key === keyFor(currentUserId())) l(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', handler);
    };
  }
  return () => listeners.delete(l);
}

/**
 * Reactive hook over the current-farm id.
 *
 * `readCurrentFarmId()` is fine for one-shot reads inside event
 * handlers, but components need a value that re-renders when the
 * id changes — otherwise the first-login dashboard reads `null`,
 * writes the farm id to localStorage in an effect, and never
 * notices the write (`enabled: !!farmId` stays false → pens/flocks
 * never fetch → user sees zeros until they refresh).
 *
 * Hydration-safe: starts as `null` on the server, syncs to the
 * persisted value on mount, and subscribes to in-tab + cross-tab
 * changes via the existing listener bus.
 */
export function useCurrentFarmId(): string | null {
  const [farmId, setFarmId] = useState<string | null>(null);

  useEffect(() => {
    // Sync once on mount — the SSR pass returned null, but the
    // browser may already have a persisted id.
    setFarmId(readCurrentFarmId());
    return onCurrentFarmChange((next) => setFarmId(next));
  }, []);

  return farmId;
}
