'use client';

import { useEffect, useState } from 'react';

/**
 * False on the server and on the first client render; true afterwards.
 *
 * WHY THIS EXISTS. Every page in this app is statically prerendered —
 * the HTML is generated once at build time and served to everyone. So
 * anything rendered from the CURRENT clock is baked in at the moment
 * the build ran: the dashboard's greeting ("Good morning") and its
 * date line were fixed at build time, and the browser then rendered
 * the real time over them.
 *
 * React treats that as a hydration mismatch and throws error #418. It
 * recovers by re-rendering the tree on the client, which is why the
 * dashboard looked fine most of the time — but the recovery throws
 * away the server HTML and re-runs everything, and on a page whose
 * data is missing that escalates into "Application error: a
 * client-side exception has occurred".
 *
 * Gate anything clock-dependent on this and the first client render
 * matches the server exactly, so there is nothing to recover from.
 *
 * NOT for hiding genuine mismatches. If server and client disagree
 * about something that is not time or device state, that is a bug to
 * fix rather than to defer by one render.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
