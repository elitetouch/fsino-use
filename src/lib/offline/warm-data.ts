'use client';

import type { QueryClient } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import { flocksKey } from '@/lib/query-keys';
import { readCurrentFarmId } from '@/lib/farm-context';
import { readToken } from '@/lib/auth';
import { isOnline } from './network';

/**
 * Fetch the data a farmer will need offline, before they are offline.
 *
 * WHY THIS EXISTS. Persisting the query cache made every screen
 * offline-capable in principle, but only for screens the farmer had
 * already opened with signal — the cache cannot hold an answer nobody
 * ever asked for. In practice that meant walking out to the pens and
 * being told "Couldn't load this cycle", because the record screen's
 * guidance had never been fetched on that device.
 *
 * "Open every screen once while you have signal" is not a thing to ask
 * of someone whose job is poultry. So the app asks on their behalf,
 * once per session, while the signal is still there.
 *
 * WHAT IT DELIBERATELY DOES NOT WARM. Anything billing — prices,
 * balances, purchases. Those are money, they are never persisted, and
 * fetching them early would only produce a figure that is wrong by the
 * time it matters.
 */

/**
 * Cycles to warm, most recent first.
 *
 * A farm with forty archived cycles should not spend forty requests on
 * app start. The ones a farmer records against are the active ones,
 * and there are rarely more than a handful.
 */
const MAX_CYCLES = 8;

/** Warmed already in this page session. */
let warmed = false;

/** Test seam — the module is a singleton in the app. */
export function resetWarmedForTests(): void {
  warmed = false;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param client The app's QueryClient. Prefetches land in the same
 *               cache the screens read from, and are persisted by the
 *               same subscription, so nothing else has to know.
 */
export async function warmOfflineData(client: QueryClient): Promise<void> {
  if (warmed) return;
  // No signal, or signed out: nothing to fetch and nobody to fetch for.
  if (!isOnline() || !readToken()) return;
  warmed = true;

  const farmId = readCurrentFarmId();

  try {
    // Preferences first — the record screen renders nothing without
    // them, and one request covers every cycle.
    await client.prefetchQuery({
      queryKey: ['my-preferences'],
      queryFn: () => endpoints.getMyPreferences(),
      staleTime: 30_000,
    });

    if (!farmId) return;

    // The flocks list under BOTH keys the app uses. They are different
    // requests returning different data — the record screen needs the
    // archived-inclusive one to tell a closed cycle from a bad id — so
    // warming one would leave the other screen cold.
    const [, withArchived] = await Promise.all([
      client.prefetchQuery({
        queryKey: flocksKey(farmId),
        queryFn: () => endpoints.listFlocks(),
      }),
      client.fetchQuery({
        queryKey: flocksKey(farmId, { includeArchived: true }),
        queryFn: () => endpoints.listFlocks({ includeArchived: true }),
      }),
    ]);

    const flocks = (withArchived?.flocks ?? [])
      .filter((f) => f.archivedAt == null)
      .slice(0, MAX_CYCLES);

    const month = currentMonth();

    // Sequential, not parallel. This runs on a phone that may be on a
    // metered connection while the farmer is actually using the app;
    // a burst of requests would compete with whatever they are doing.
    for (const flock of flocks) {
      try {
        await client.prefetchQuery({
          queryKey: ['daily-record-guidance', flock.id],
          queryFn: () => endpoints.getDailyRecordGuidance(flock.id),
          staleTime: 60_000,
        });
        await client.prefetchQuery({
          queryKey: ['daily-record-calendar', flock.id, month],
          queryFn: () => endpoints.getDailyRecordCalendar(flock.id, month),
          staleTime: 30_000,
        });
      } catch {
        // One cycle failing must not cost the farmer the rest.
      }
    }
  } catch {
    // Warming is best effort by definition. Everything here is also
    // fetched normally by the screen that needs it; this only decides
    // whether that fetch happens now, with signal, or later without.
  }
}

/**
 * Warm one cycle, because the farmer is looking at it.
 *
 * The session warm covers the first few active cycles. This covers the
 * one actually in front of them, which is the one they are most likely
 * to still be holding when the signal goes.
 */
const warmedCycles = new Set<string>();

export async function warmCycle(client: QueryClient, flockId: string): Promise<void> {
  if (warmedCycles.has(flockId)) return;
  if (!isOnline() || !readToken()) return;
  warmedCycles.add(flockId);

  const month = currentMonth();
  try {
    await client.prefetchQuery({
      queryKey: ['daily-record-guidance', flockId],
      queryFn: () => endpoints.getDailyRecordGuidance(flockId),
      staleTime: 60_000,
    });
    await client.prefetchQuery({
      queryKey: ['daily-record-calendar', flockId, month],
      queryFn: () => endpoints.getDailyRecordCalendar(flockId, month),
      staleTime: 30_000,
    });
  } catch {
    /* best effort — the screen fetches this itself too */
  }
}
