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

const KEY = 'fsm.app.currentFarmId';

const listeners = new Set<(farmId: string | null) => void>();

export function readCurrentFarmId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v !== 'null' && v !== 'undefined' ? v : null;
  } catch {
    return null;
  }
}

export function writeCurrentFarmId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
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
      if (e.key === KEY) l(e.newValue);
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
