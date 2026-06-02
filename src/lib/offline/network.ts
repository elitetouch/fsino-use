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

let verifiedOnline: boolean | null = null;
const listeners = new Set<Listener>();
let probeInFlight = false;

const HEALTH_URL = '/api/v1/health'; // expected to be a cheap public endpoint
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

async function probeNetwork(): Promise<boolean> {
  if (probeInFlight) return verifiedOnline ?? navigator.onLine;
  probeInFlight = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      // Don't send credentials on the probe — keeps it cheap and avoids
      // touching auth/session middleware.
      credentials: 'omit',
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
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
  window.addEventListener('online', handleBrowserEvent);
  window.addEventListener('offline', handleBrowserEvent);
  // Initial probe — establish baseline.
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
