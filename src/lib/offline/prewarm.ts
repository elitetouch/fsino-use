'use client';

import { isOnline } from './network';
import { readToken } from '@/lib/auth';

/**
 * Ask the service worker to cache the screens this farmer will need
 * when the signal goes.
 *
 * WHY THIS EXISTS. The service worker precaches the routes we can name
 * at build time, but in the App Router a document only reaches the
 * cache on its own if the farmer does a full browser reload while
 * standing on it — an in-app tap is a client-side transition and never
 * fetches one. So the screens a farmer uses all day were the screens
 * least likely to be cached, and the app opened to the offline page in
 * exactly the place it was built for.
 *
 * It also covers what a build-time list cannot: `/cycles/<id>/record`
 * is the screen that matters in a pen with no signal, and the id is
 * this farmer's.
 *
 * Each path is warmed once per page load. The service worker fetches
 * them one at a time in the background, so this costs a farmer on a
 * metered connection a handful of small requests, not a burst.
 */

/**
 * The screens a farmer moves between on a normal day. `/cycles` and
 * `/home` are the two the launcher lands on; the rest are one tap from
 * the menu and useless as a dead link.
 */
const CORE_PATHS: readonly string[] = [
  '/home',
  '/menu',
  '/cycles',
  '/pens-flocks',
  '/reports',
  '/expenses',
  '/sales',
  '/settings',
  '/sync',
  '/profile',
];

/** Warmed already this page load — the SW caches, we just don't re-ask. */
const asked = new Set<string>();

function post(paths: string[]): void {
  const fresh = paths.filter((p) => !asked.has(p));
  if (fresh.length === 0) return;
  for (const p of fresh) asked.add(p);

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Signed out, or no signal: nothing to warm and nothing to warm it
  // with. A farmer who is already offline is past the point this helps.
  if (!isOnline() || !readToken()) return;

  void navigator.serviceWorker.ready
    .then((reg) => {
      const worker = reg.active;
      if (!worker) return;
      worker.postMessage({ type: 'FSM_PREWARM', paths: fresh });
    })
    .catch(() => {
      /* No service worker on this browser — the app still works online. */
    });
}

/** The day-to-day screens. Call once the farmer is signed in. */
export function prewarmCore(): void {
  post([...CORE_PATHS]);
}

/**
 * The cycle the farmer is actually looking at, plus its record screen —
 * which is the one they will open standing in the pen.
 *
 * Driven by the current path rather than by stored state so it needs no
 * farm context and cannot warm a cycle this user has no business
 * reading. Ids are matched against a conservative character set: the
 * path becomes a URL the browser fetches with their session, so
 * anything that could carry a traversal or a second path segment is
 * left alone.
 */
export function prewarmForPath(pathname: string | null | undefined): void {
  if (!pathname) return;
  const match = /^\/cycles\/([A-Za-z0-9_-]{1,64})(?:\/|$)/.exec(pathname);
  if (!match) return;
  const id = match[1];
  post([`/cycles/${id}`, `/cycles/${id}/record`]);
}
