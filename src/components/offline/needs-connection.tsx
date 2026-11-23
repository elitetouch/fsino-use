'use client';

import { CloudOff } from 'lucide-react';

/**
 * "This part needs a connection."
 *
 * Most of this app is built to work with no signal, and that is the
 * promise a farmer reasonably reads into every screen. Billing is the
 * exception: prices, token balances and payments are live figures and
 * a live redirect to a payment provider, none of which can be answered
 * from a cache.
 *
 * So those screens say so, rather than rendering a page with the
 * prices missing and a Buy button that fails on tap. A screen that
 * cannot work right now should explain itself; the failure mode this
 * replaces is a farmer filling in a quantity, committing to a purchase
 * and getting "Could not start payment."
 *
 * Deliberately NOT the offline page: the rest of the app is still
 * working around them, and saying "you're offline" in the middle of an
 * app that is visibly running reads as a bug.
 */
export function NeedsConnection({
  title = 'This needs a connection',
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-muted)]">
          <CloudOff className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-bold text-[var(--color-brand-fg)]">{title}</p>
          <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--color-brand-muted)]">
            {children ?? (
              <>
                Prices and token balances are live figures, so we can&rsquo;t show
                them without signal. Everything you record today is still being
                saved and will upload by itself.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
