'use client';

import { useEffect } from 'react';
import { startSync, requestPersistentStorage } from '@/lib/offline';

/**
 * Service-worker registration + offline-engine boot.
 *
 * Mounted exactly once near the root of the tree. Idempotent — extra
 * mounts are no-ops because startSync() and navigator.serviceWorker.register
 * both dedupe internally.
 *
 * On update: the new SW takes over silently. We don't force-reload the
 * page because that would interrupt a farmer mid-log.
 */
export function SwRegistration() {
  useEffect(() => {
    // Boot the offline engine regardless of SW availability — the
    // IndexedDB outbox and read cache work even without SW (just no
    // background sync, no offline app shell).
    startSync();

    // Persistent storage request — fire & forget; failure is fine.
    void requestPersistentStorage();

    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV === 'development'
    ) {
      // Skip SW registration in dev — Next dev server doesn't play well
      // with cached assets.
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        registration = reg;

        // Handle waiting worker — newer version installed but not active.
        if (reg.waiting) {
          // Don't auto-skipWaiting; let the next navigation pick it up.
          // This keeps long sessions stable.
        }

        // Listen for new updates landing while the app is open.
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // A new version is ready. Stored for telemetry; we don't
              // bother the user.
              console.info('[fsm-sw] update available — will activate on next reload.');
            }
          });
        });

        // Background sync registration — Chrome only; iOS Safari throws,
        // which we swallow.
        try {
          const swReg = reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
          if (swReg.sync) {
            void swReg.sync.register('fsm-outbox-drain').catch(() => {
              /* not supported here — fine */
            });
          }
        } catch {
          /* not supported — fine */
        }
      })
      .catch((err) => {
        console.warn('[fsm-sw] registration failed:', err);
      });

    // On controller change, re-register sync so the new SW knows about
    // pending tags.
    const onCtrlChange = () => {
      if (!registration) return;
      try {
        const swReg = registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
        if (swReg.sync) {
          void swReg.sync.register('fsm-outbox-drain').catch(() => undefined);
        }
      } catch {
        /* no-op */
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onCtrlChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onCtrlChange);
    };
  }, []);

  return null;
}
