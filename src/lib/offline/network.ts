'use client';

/**
 * Network state — augments navigator.onLine with active health checks.
 *
 * navigator.onLine lies. A device with Wi-Fi connected to a router that
 * has no internet uplink reports true. A captive portal reports true.
 * iOS sometimes reports false right after wake even when connected.
 *
 * We treat navigator.onLine as a hint, then verify with a lightweight
 * health-check request when state changes. The exported listener API
 * gives subscribers the verified state, not the raw browser flag.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

type Listener = (online: boolean) => void;

// Initial state defaults to navigator.onLine if available. Critical:
// we never start in a "definitely offline" state — the probe can only
// CONFIRM offline, never assert it from nothing. This avoids the
// false-positive offline banner on first paint when the probe hasn't
// run yet.
let verifiedOnline: boolean | null = null;
const listeners = new Set<Listener>();
let probeInFlight = false;

/**
 * Absolute URL to the backend health probe. Built from the same env
 * the API client uses so we never accidentally probe the frontend host
 * (which would always 404).
 *
 * Falls back to a meta-fetch of the app's own root if the env var is
 * unset — that still verifies "we have network", just doesn't confirm
 * the backend specifically is reachable.
 */
function buildHealthUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim();
  if (!raw) return '/'; // last resort: probe our own origin
  const trimmed = raw.replace(/\/+$/, '');
  const host = trimmed.replace(/\/api(?:\/v\d+)?$/i, '');
  return `${host}/api/v1/health`;
}

const HEALTH_TIMEOUT_MS = 4000;
const PROBE_DEBOUNCE_MS = 1500;
let probeTimer: ReturnType<typeof setTimeout> | null = null;

function notify(state: boolean) {
  for (const l of listeners) {
    try {
      l(state);
    } catch (err) {
      console.error('[fsm-offline] network listener threw:', err);
    }
  }
}

/**
 * Probe the backend health endpoint. Returns true if we got ANY HTTP
 * response back (including 404 / 5xx) — that proves the network works.
 * Only true network errors (DNS / TCP / TLS / CORS / timeout / abort)
 * count as "offline".
 *
 * This matters because:
 *   - The /health endpoint may not be deployed yet → 404. Network is fine.
 *   - The backend may be 503'd → still proves we have connectivity.
 *   - A captive portal returns its own 200 page — we can't tell that
 *     apart from a real backend response, so we trust it. (Captive
 *     portals are rare in the farmer audience and a follow-up if needed.)
 */
async function probeNetwork(): Promise<boolean> {
  if (probeInFlight) return verifiedOnline ?? navigator.onLine;
  probeInFlight = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      await fetch(buildHealthUrl(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        credentials: 'omit',
        // Use `no-cors` mode if absolutely needed — but we WANT the
        // server's response status, so default (cors) is fine. The
        // probe doesn't need any data, just the HTTP round-trip.
      });
      clearTimeout(timer);
      // Reaching here means we got an HTTP response of some kind →
      // network is up, regardless of status code.
      return true;
    } catch {
      clearTimeout(timer);
      // Re-throw classification: AbortError + TypeError ("Failed to
      // fetch") indicate real network problems. Treat as offline.
      return false;
    }
  } finally {
    probeInFlight = false;
  }
}

function scheduleProbe() {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(async () => {
    const result = await probeNetwork();
    if (result !== verifiedOnline) {
      verifiedOnline = result;
      notify(result);
    }
  }, PROBE_DEBOUNCE_MS);
}

function handleBrowserEvent() {
  // If the browser says we're offline, trust it immediately (no need
  // to probe). If it says we're online, debounce + verify.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (verifiedOnline !== false) {
      verifiedOnline = false;
      notify(false);
    }
    return;
  }
  scheduleProbe();
}

if (typeof window !== 'undefined') {
  // Seed verifiedOnline from the browser flag so the first render of
  // the OfflineBanner already knows the state — no flash of "you're
  // offline" while waiting for the first probe.
  verifiedOnline = navigator.onLine;

  window.addEventListener('online', handleBrowserEvent);
  window.addEventListener('offline', handleBrowserEvent);
  // Initial probe — establish baseline. Background; never blocks.
  scheduleProbe();
}

/**
 * Subscribe to verified network state. Returns an unsubscribe function.
 */
export function onNetworkChange(listener: Listener): () => void {
  listeners.add(listener);
  // Replay the latest known state immediately so callers don't have to
  // wait for the next change.
  if (verifiedOnline !== null) {
    queueMicrotask(() => listener(verifiedOnline as boolean));
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Current best-effort state. May be stale by up to PROBE_DEBOUNCE_MS. */
export function isOnline(): boolean {
  if (verifiedOnline !== null) return verifiedOnline;
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/** Force a re-probe — useful after the user taps "Try again". */
export async function forceNetworkProbe(): Promise<boolean> {
  const result = await probeNetwork();
  if (result !== verifiedOnline) {
    verifiedOnline = result;
    notify(result);
  }
  return result;
}

// ─────────────── React hook ───────────────

/**
 * `useOnline()` — re-renders when network state changes. Uses
 * useSyncExternalStore for tear-free concurrent-mode safety.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onNetworkChange(cb),
    () => isOnline(),
    () => true, // SSR fallback: assume online to match the optimistic UX
  );
}

/**
 * `useOnlineTransition()` — emits an extra value: `wasOffline` so the
 * UI can fire a "you're back online" toast on the transition rather
 * than every render.
 */
export function useOnlineTransition(): { online: boolean; justReconnected: boolean } {
  const online = useOnline();
  const [justReconnected, setJustReconnected] = useState(false);
  const [prev, setPrev] = useState(online);
  useEffect(() => {
    if (online && !prev) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 4000);
      return () => clearTimeout(t);
    }
    setPrev(online);
    return undefined;
  }, [online, prev]);
  return { online, justReconnected };
}
