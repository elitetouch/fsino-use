'use client';

import { QueryClient, QueryClientProvider, IsRestoringProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { restoreQueryCache, startQueryPersistence } from '@/lib/offline/query-persist';
import { DataWarmer } from '@/components/offline/data-warmer';

/**
 * How long the restore may hold queries before the app proceeds
 * without it. Reading a few hundred kilobytes from IndexedDB is tens
 * of milliseconds; anything approaching this means the database is
 * blocked or broken, and waiting longer helps nobody.
 */
const RESTORE_TIMEOUT_MS = 2_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,

            // One retry online, none offline. Retrying a request that
            // cannot leave the device spends battery to reach the same
            // answer and delays the error the farmer needs to see.
            retry: (failureCount: number) =>
              typeof navigator !== 'undefined' && navigator.onLine === false
                ? false
                : failureCount < 1,

            /*
             * Three settings that together are what makes a read work
             * with no signal. They are defaults rather than per-query
             * options on purpose: the app has 71 useQuery call sites
             * and any new one must be offline-capable without being
             * asked to.
             *
             * gcTime — a query React Query has collected cannot be
             * written to disk, and the default is five minutes. A
             * farmer who opens the app in the morning and walks out to
             * the pens at noon would have had their cache emptied
             * before they lost signal. A week matches the persisted
             * cache's own maximum age.
             *
             * networkMode 'offlineFirst' — the default ('online')
             * leaves queries PAUSED when the browser reports no
             * connection, so a screen with perfectly good cached data
             * renders a spinner that never resolves. 'offlineFirst'
             * runs the query, serves what is cached, and lets the
             * failure surface as a failure.
             */
            gcTime: 7 * 24 * 60 * 60 * 1000,
            networkMode: 'offlineFirst',
          },
          mutations: { retry: 0, networkMode: 'offlineFirst' },
        },
      }),
  );

  /*
   * Hold the QUERIES, not the render, until the cache is back from
   * IndexedDB.
   *
   * Letting queries fire first means every read on the first screen
   * runs, fails with no signal, and paints its error state — and the
   * restored data then arrives too late to stop the farmer seeing it.
   *
   * But gating `children` on a client-only flag is worse: the server
   * renders the page and the first client render returns null, which
   * is a hydration mismatch and takes the whole app down with
   * "a client-side exception has occurred". IsRestoringProvider is
   * React Query's own answer — the tree renders normally and
   * individual queries hold off until the restore is done.
   */
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let stopPersisting: (() => void) | null = null;

    /*
     * THE RESTORE MUST NEVER BE ABLE TO HOLD THE APP OPEN-ENDEDLY.
     *
     * While `isRestoring` is true React Query fetches nothing, and
     * `usePermissions` is a query — so a restore that never settles
     * leaves every gated screen reporting "Can't load this page
     * offline yet" with a perfectly good connection. That is a worse
     * failure than having no persisted cache at all, and it is what
     * shipped: `openDB` has no timeout, and IndexedDB blocks
     * indefinitely when another tab holds an older version of the
     * database, which is ordinary on a phone with the app open twice.
     *
     * So the gate opens on whichever comes first, the restore or the
     * deadline. Losing the cache costs offline reads for one session;
     * losing the gate costs the whole app.
     */
    const settle = () => {
      if (cancelled || settled) return;
      settled = true;
      // Persistence starts AFTER the restore, so a partially hydrated
      // cache can never be written back over the complete one.
      stopPersisting = startQueryPersistence(qc);
      setRestored(true);
    };

    const deadline = setTimeout(settle, RESTORE_TIMEOUT_MS);
    void restoreQueryCache(qc).finally(() => {
      clearTimeout(deadline);
      settle();
    });

    return () => {
      cancelled = true;
      clearTimeout(deadline);
      stopPersisting?.();
    };
  }, [qc]);

  return (
    <QueryClientProvider client={qc}>
      <IsRestoringProvider value={!restored}>
        {children}
        {/* Mounted after the restore gate so warming cannot race the
            cache coming back off disk and refetch what we just had. */}
        {restored && <DataWarmer />}
        <Toaster position="top-center" richColors closeButton />
      </IsRestoringProvider>
    </QueryClientProvider>
  );
}
