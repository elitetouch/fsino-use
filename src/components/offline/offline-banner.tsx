'use client';

import { useOnlineTransition, useOutboxCounts, forceNetworkProbe } from '@/lib/offline';
import { CloudOff, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

/**
 * Slim banner at the top of the viewport when the device is offline or
 * has pending mutations syncing. Auto-hides when everything is green.
 *
 * States (in priority order):
 *   1. Conflict or failed-permanent → red, "X issues need your attention"
 *   2. Offline                      → amber, "You're offline — N changes saved"
 *   3. Pending or in-flight (online) → soft green, "Syncing N changes…"
 *   4. Just reconnected (no pending) → soft green for 4s, "Back online"
 *   5. Default (online + no pending) → hidden
 *
 * Position: fixed top, full width, below the marketing nav.
 */
export function OfflineBanner() {
  const { online, justReconnected } = useOnlineTransition();
  const counts = useOutboxCounts();
  const [probing, setProbing] = useState(false);

  const issues = counts.conflict + counts['failed-permanent'] + counts.parked;
  const pending = counts.pending + counts['in-flight'];

  // Hide when there's nothing to say.
  if (online && pending === 0 && issues === 0 && !justReconnected) {
    return null;
  }

  let tone: 'red' | 'amber' | 'green' = 'green';
  let icon = <CheckCircle2 className="h-4 w-4" />;
  let message: React.ReactNode = 'Back online';
  let action: React.ReactNode = null;

  if (issues > 0) {
    tone = 'red';
    icon = <CloudOff className="h-4 w-4" />;
    message = `${issues} ${issues === 1 ? 'change needs' : 'changes need'} your attention`;
    action = (
      <a
        href="/sync"
        className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white underline-offset-2 hover:underline"
      >
        Review
      </a>
    );
  } else if (!online) {
    tone = 'amber';
    icon = <CloudOff className="h-4 w-4" />;
    message =
      pending > 0
        ? `You're offline — ${pending} ${pending === 1 ? 'change' : 'changes'} saved on this device`
        : `You're offline — anything you log will sync when you're back`;
    action = (
      <button
        type="button"
        disabled={probing}
        onClick={async () => {
          setProbing(true);
          await forceNetworkProbe();
          setProbing(false);
        }}
        className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25"
      >
        {probing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Try again
      </button>
    );
  } else if (pending > 0) {
    tone = 'green';
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    message = `Syncing ${pending} ${pending === 1 ? 'change' : 'changes'}…`;
  } else if (justReconnected) {
    tone = 'green';
    icon = <CheckCircle2 className="h-4 w-4" />;
    message = 'Back online — all changes synced';
  }

  const bg = {
    red:   'bg-[var(--color-brand-danger)]',
    amber: 'bg-[var(--color-brand-warning)]',
    green: 'bg-[var(--color-brand-primary)]',
  }[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-fade-in fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white shadow-md ${bg}`}
    >
      {icon}
      <span>{message}</span>
      {action}
    </div>
  );
}
