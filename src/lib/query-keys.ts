/**
 * Shared React Query key builders.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nine pages fetched the flocks list under the key ['flocks', farmId],
 * but with two DIFFERENT requests behind it: most asked for active
 * cycles only, while /reports and /expenses asked for archived ones too.
 *
 * React Query caches by key, so whichever page fetched last owned the
 * entry. Landing on /reports first and then opening a cycle showed the
 * archived cycle fine; reloading straight onto the cycle page refetched
 * active-only and the same cycle vanished. Identical URL, different
 * result, depending entirely on navigation history.
 *
 * The rule a key has to satisfy is simple: if two requests can return
 * different data, they must not share a key. These helpers fold the
 * request parameters into the key so that holds by construction.
 *
 * Keys stay prefixed with 'flocks', so existing
 * invalidateQueries({ queryKey: ['flocks'] }) calls still match
 * everything via React Query's prefix matching.
 */

export type FlocksQueryOpts = {
  includeArchived?: boolean;
  penId?: string;
};

/**
 * Key for the flocks list.
 *
 * farmId is always included — without it, switching farms reuses the
 * previous farm's cached list, which two call sites were doing.
 */
export function flocksKey(farmId: string | null | undefined, opts: FlocksQueryOpts = {}) {
  return [
    'flocks',
    farmId ?? null,
    {
      includeArchived: opts.includeArchived ?? false,
      penId: opts.penId ?? null,
    },
  ] as const;
}
