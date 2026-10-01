'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

/**
 * "Open in FSI Farm Manager" — the explicit, user-initiated route into
 * the Android app.
 *
 * THIS IS NOT HOW APP LINKS WORK, and it is not meant to be. Android
 * App Links are an operating-system feature: Android reads
 * /.well-known/assetlinks.json, decides the app owns this domain, and
 * opens it before the browser ever renders. That path needs no
 * JavaScript and no button.
 *
 * This is the fallback for everything that path does not cover — a
 * browser that has not yet verified the domain, a user who once chose
 * "always open in Chrome", a link opened inside Facebook or WhatsApp's
 * in-app browser, which is how a great many invitations actually get
 * tapped.
 *
 * WHY NOT A REDIRECT
 * ------------------
 * The obvious-looking version of this is
 * `window.location.href = 'fsino://invite/...'` on mount. Do not. It
 * breaks desktop entirely, modern browsers block custom schemes from
 * script, and when the app is not installed the user is left on a dead
 * page with no way forward. An intent:// URL behind a deliberate tap
 * has a declared fallback and degrades properly.
 *
 * ANDROID ONLY
 * ------------
 * intent:// is a Chrome-on-Android scheme. It is meaningless on iOS and
 * desktop, so the button renders nowhere else rather than offering
 * something that cannot work.
 */

const PACKAGE = 'com.farmsupportinnovation.fsino';

/**
 * Where a device without the app should land.
 *
 * Deliberately NOT the Play Store listing yet: the app is still in
 * review, and a Play URL for an unpublished app shows "item not found",
 * which reads as a broken product rather than one that is nearly ready.
 * Swap this for
 * `https://play.google.com/store/apps/details?id=com.farmsupportinnovation.fsino`
 * the day it goes live.
 */
const FALLBACK_URL = 'https://fsinnovation.net/';

function intentUrl(path: string): string {
  // S.browser_fallback_url must be encoded or Chrome truncates it at
  // the first ';' and the fallback silently does nothing.
  const fallback = encodeURIComponent(FALLBACK_URL);
  const target = path.replace(/^\//, '');
  return `intent://${target}#Intent;scheme=fsino;package=${PACKAGE};S.browser_fallback_url=${fallback};end`;
}

export function OpenInApp({ path = '/', className }: { path?: string; className?: string }) {
  const [isAndroid, setIsAndroid] = useState(false);

  // Read the UA after mount, not during render: the server has no
  // navigator, and branching on it during render would desync the
  // hydrated markup from the HTML Next.js already sent.
  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);

  if (!isAndroid) return null;

  return (
    <a
      href={intentUrl(path)}
      className={
        className ??
        'inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-white px-4 text-[0.875rem] font-semibold text-[var(--color-brand-fg)] transition-colors hover:border-[var(--color-brand-primary)]/40'
      }
    >
      <Smartphone className="h-4 w-4" />
      Open in FSI Farm Manager
    </a>
  );
}
