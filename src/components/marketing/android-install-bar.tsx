'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PLAY_STORE_URL } from '@/lib/links';

/**
 * Sticky install prompt, shown only to Android phones.
 *
 * WHY DEVICE-TARGETED. A "Get it on Google Play" banner shown to a
 * desktop visitor is a wasted impression and teaches everyone to ignore
 * the next one. Shown to someone already holding the device they would
 * install it on, it is the highest-converting element on the page. So
 * it renders for Android and nowhere else.
 *
 * WHY ONLY THE PUBLIC PAGES. This is mounted by the landing page and by
 * the legal and (marketing) layouts — never inside (app). Someone who
 * has signed in is already a user; prompting them to install over the
 * bottom navigation of the thing they are using is noise.
 *
 * WHY NOT IMMEDIATELY. It appears after 600px of scroll — by then the
 * visitor has shown interest, and a bar that covers content before
 * anyone has read a sentence is the kind people close reflexively.
 *
 * Dismissal is remembered. localStorage can throw in private mode and
 * can come back empty, so every access is wrapped; the failure mode is
 * one extra prompt, never a crash.
 *
 * Mirrored by `src/components/android-install-bar.tsx` in fsino-landing.
 */

const DISMISS_KEY = 'fsi.installbar.dismissed';
const SHOW_AFTER_PX = 600;

export function AndroidInstallBar() {
  const [eligible, setEligible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Read the UA after mount, never during render: the server has no
  // navigator, and branching on it while rendering would desync the
  // hydrated markup from the HTML already sent.
  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    setEligible(isAndroid && window.innerWidth < 900);

    let stored = false;
    try {
      stored = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* private mode or blocked storage — treat as not dismissed */
    }
    setDismissed(stored);
  }, []);

  useEffect(() => {
    if (!eligible || dismissed) return;
    const onScroll = () => setScrolled(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [eligible, dismissed]);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* it will simply ask again next visit */
    }
  }

  if (!eligible || dismissed || !scrolled) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-white/95 backdrop-blur-lg"
      // Clears the phone's home indicator / gesture bar.
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="region"
      aria-label="Install the Android app"
    >
      <div
        className="mx-auto flex items-center gap-3 px-4 py-3"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-[var(--color-brand-fg)]">
            FSI Farm Manager
          </p>
          <p className="truncate text-[12px] text-[var(--color-brand-muted)]">
            Free · Records save even when the network drops
          </p>
        </div>

        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-[var(--color-brand-primary-deep)] px-5 py-2.5 text-[13.5px] font-bold text-white active:scale-[0.98]"
        >
          Install
        </a>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 shrink-0 rounded-full p-2 text-[var(--color-brand-muted)] active:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
