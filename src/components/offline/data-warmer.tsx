'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useOnline } from '@/lib/offline';
import { warmOfflineData, warmCycle } from '@/lib/offline/warm-data';

/**
 * Pulls the data a farmer will need offline while they still have
 * signal. See `lib/offline/warm-data.ts` for the reasoning.
 *
 * Mounted inside Providers because it needs the QueryClient — the
 * service worker's own prewarm lives in SwRegistration, which sits
 * outside it and caches pages rather than data. The two are halves of
 * the same idea: that one caches the screen, this one caches what the
 * screen shows.
 */
export function DataWarmer() {
  const client = useQueryClient();
  const online = useOnline();
  const pathname = usePathname();

  // Once per session, and again if the farmer comes back online
  // having started the app with no signal.
  useEffect(() => {
    if (!online) return;
    void warmOfflineData(client);
  }, [client, online]);

  // The cycle actually on screen — the one most likely to still be
  // open when the signal goes.
  useEffect(() => {
    if (!online || !pathname) return;
    const match = /^\/cycles\/([A-Za-z0-9_-]{1,64})(?:\/|$)/.exec(pathname);
    if (!match) return;
    void warmCycle(client, match[1]);
  }, [client, online, pathname]);

  return null;
}
