'use client';

import { useEffect, useState } from 'react';
import { Share, Plus, X } from 'lucide-react';

const DISMISS_KEY = 'fsm.iosInstall.dismissedAt';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60_000; // 7 days

/**
 * "Add to Home Screen" hint shown only to iOS Safari users who haven't
 * installed the PWA yet. iOS has no native install prompt API, so we
 * show a soft instructional toast on first useful interaction.
 *
 * Why this matters for offline:
 *   - iOS Safari evicts non-installed-site storage after 7 days of
 *     inactivity. Once added to home screen, storage is persistent
 *     and the user gets a real standalone window.
 *
 * Behaviour:
 *   - Detects iOS Safari (not Chrome on iOS, not standalone PWA).
 *   - Shows after the user has been on the page for 8 seconds (not
 *     immediately — gives time to read the page first).
 *   - Dismiss persists for 7 days in localStorage.
 */
export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isIOS || !isSafari || isStandalone) return;

    let dismissedAt = 0;
    try {
      dismissedAt = parseInt(window.localStorage.getItem(DISMISS_KEY) ?? '0', 10);
    } catch {
      /* ignore */
    }
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const timer = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Farm Support Innovation"
      className="animate-fade-up fixed inset-x-4 bottom-4 z-[55] mx-auto max-w-md rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 shadow-[0_20px_60px_-20px_rgba(15,80,30,0.30)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Plus className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-[var(--color-brand-fg)]">
            Install Farm Support Innovation on this iPhone
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-brand-muted)]">
            Tap{' '}
            <span className="inline-flex h-5 w-5 -translate-y-0.5 items-center justify-center rounded-md bg-[var(--color-brand-surface-soft)] align-middle">
              <Share className="h-3 w-3" />
            </span>{' '}
            then <strong>Add to Home Screen</strong> — works offline and keeps
            your records safe.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
