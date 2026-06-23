'use client';

/**
 * Last-visited cycle memory — per staff, per farm.
 *
 * When a staff returns to the app they should land on the cycle they
 * were last looking at, not whatever the dashboard's default-pick
 * heuristic would choose. Two staff on the same farm have independent
 * memory (each carries their own working flock); the same staff on
 * two farms also has independent memory (no cross-contamination if
 * cycle ids happen to repeat across farms — they don't with UUIDs,
 * but the scoping is the correct mental model).
 *
 * Storage key: `fsm.app.lastCycle:<farmId>:<userId>` — both axes
 * encoded so a single localStorage entry can only ever apply to
 * exactly one (user, farm) pair.
 *
 * The id is opaque (we don't validate shape here). The caller is
 * responsible for falling back when the stored id no longer matches
 * any active flock (archived, deleted, transferred to another pen
 * etc.) — see use-pick-default-flock for the validation step.
 */

const PREFIX = 'fsm.app.lastCycle';

function key(farmId: string | number, userId: string | number): string {
  return `${PREFIX}:${farmId}:${userId}`;
}

export function readLastCycle(
  farmId: string | number | null | undefined,
  userId: string | number | null | undefined,
): string | null {
  if (typeof window === 'undefined') return null;
  if (!farmId || !userId) return null;
  try {
    const v = window.localStorage.getItem(key(farmId, userId));
    return v && v !== 'null' && v !== 'undefined' ? v : null;
  } catch {
    return null;
  }
}

export function writeLastCycle(
  farmId: string | number | null | undefined,
  userId: string | number | null | undefined,
  flockId: string | null,
): void {
  if (typeof window === 'undefined') return;
  if (!farmId || !userId) return;
  try {
    if (flockId) window.localStorage.setItem(key(farmId, userId), flockId);
    else window.localStorage.removeItem(key(farmId, userId));
  } catch {
    /* ignore */
  }
}
