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
