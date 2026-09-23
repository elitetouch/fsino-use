'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Clock, Lock, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  endpoints, apiErrorMessage, insufficientTokens,
  type CycleWriteWindow, type InsufficientTokens,
} from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Gate } from '@/lib/access';

/**
 * Tells a farmer their paid tracking window is ending, or has ended.
 *
 * WHY THIS IS NOT JUST AN ERROR TOAST
 * -----------------------------------
 * The backend already refuses records past the window. Without this the
 * farmer's first sign of it is a rejection AFTER filling in a whole daily
 * record — technically correct, and the worst possible moment to learn.
 * Worse, a rejection is a dead end: it says no without saying how to fix
 * it, so the farm stops logging instead of renewing.
 *
 * The lock only earns its keep if the way out is on the same screen.
 *
 * TWO STATES, DELIBERATELY DIFFERENT IN TONE
 * ------------------------------------------
 * `grace` is a heads-up: everything still works, here is the deadline.
 * Alarming someone whose cycle is fine is how banners get ignored.
 * `locked` is a stop: what has happened, what still works, what to do.
 */
export function CycleWindowBanner({
  flockId,
  window,
  onRenewed,
}: {
  flockId: string;
  window?: CycleWriteWindow;
  onRenewed?: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // A renewal that failed only because the wallet is short. Held apart
  // from `error` because it is not really an error state — it is an
  // unfinished purchase, and it gets a way forward rather than red text.
  const [short, setShort] = useState<InsufficientTokens | null>(null);

  const renew = useMutation({
    mutationFn: () => endpoints.renewFlock(flockId),
    onSuccess: () => {
      setError(null);
      setShort(null);
      // The window governs what the record wizard, the cycle page and the
      // flocks list each render, so refresh all of them rather than
      // leaving one showing a lock that no longer exists.
      void qc.invalidateQueries({ queryKey: ['flocks'] });
      void qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['daily-record-guidance', flockId] });
      onRenewed?.();
    },
    onError: (e) => {
      const gap = insufficientTokens(e);

      if (gap) {
        // Not shown as a failure. The farmer did nothing wrong; they
        // just have not bought the tokens yet.
        setShort(gap);
        setError(null);
        return;
      }

      setShort(null);
      setError(apiErrorMessage(e, "Couldn't renew this cycle."));
    },
  });

  // Nothing to say while the cycle is inside its window. `closed` is an
  // archived cycle, which has its own copy elsewhere and must never be
  // told to renew — the farmer ended it on purpose.
  if (!window || window.state === 'active' || window.state === 'closed') {
    return null;
  }

  const locked = window.state === 'locked';
  const days = window.graceDaysLeft ?? 0;

  return (
    <div
      className={[
        'rounded-xl border p-4',
        locked
          ? 'border-[var(--color-brand-danger)]/35 bg-[var(--color-brand-danger)]/[0.06]'
          : 'border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            locked
              ? 'bg-[var(--color-brand-danger)]/12 text-[var(--color-brand-danger)]'
              : 'bg-white text-[var(--color-brand-muted)]',
          ].join(' ')}
        >
          {locked ? <Lock className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.84375rem] font-semibold text-[var(--color-brand-fg)]">
            {locked
              ? 'This cycle is no longer being tracked'
              : days <= 1
                ? 'Tracking ends today'
                : `Tracking ends in ${days} days`}
          </p>

          <p className="mt-0.5 text-[0.78125rem] leading-relaxed text-[var(--color-brand-muted)]">
            {locked ? (
              <>
                The tracking period ended on{' '}
                <strong className="text-[var(--color-brand-fg)]">{fmtDate(window.validUntil)}</strong>, so new
                records can&apos;t be added. Everything you&apos;ve already recorded — and the full
                report — stays available.
              </>
            ) : (
              <>
                You can keep adding records until{' '}
                <strong className="text-[var(--color-brand-fg)]">{fmtDate(window.graceEndsAt)}</strong>. Renew
                before then and nothing is interrupted.
              </>
            )}
          </p>

          {/* Renewal costs one token per live bird, so it is gated on the
              same permission the backend checks. A staff member who
              cannot renew shouldn't be shown a button that 403s. */}
          <Gate perm="flocks.renew">
            <div className="mt-3">
              <Button
                size="sm"
                variant={locked ? 'primary' : 'outline'}
                onClick={() => renew.mutate()}
                disabled={renew.isPending}
              >
                {renew.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Renew cycle
              </Button>
            </div>
          </Gate>

          {short && (
            /*
             * THE POINT OF THIS WHOLE COMPONENT.
             *
             * Previously an empty wallet printed "Insufficient broiler
             * basic tokens. Required: 300." in red and stopped there —
             * a farmer whose cycle had locked was told the problem and
             * left to find the wallet, work out the shortfall, and get
             * the token type and tier right on their own.
             *
             * Now the numbers come from the server and the button goes
             * straight to the wallet with the right token, the right
             * tier and the exact shortfall already filled in.
             */
            <div className="mt-3 rounded-lg border border-[var(--color-brand-border)] bg-white p-3">
              <p className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--color-brand-fg)]">
                <Wallet className="h-3.5 w-3.5 text-[var(--color-brand-muted)]" />
                {short.shortfall.toLocaleString()} more{' '}
                {short.shortfall === 1 ? 'token' : 'tokens'} needed
              </p>

              {/* The arithmetic shown rather than asserted. A farmer
                  about to spend money should be able to check it. */}
              <dl className="mt-2 space-y-1 text-[0.75rem] text-[var(--color-brand-muted)]">
                <div className="flex justify-between gap-3">
                  <dt>
                    Renewal cost ({short.tokenType} · {short.tier})
                  </dt>
                  <dd className="tabular-nums text-[var(--color-brand-fg)]">
                    {short.required.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>In your wallet</dt>
                  <dd className="tabular-nums text-[var(--color-brand-fg)]">
                    {short.available.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-[var(--color-brand-border)] pt-1 font-semibold">
                  <dt className="text-[var(--color-brand-fg)]">To buy</dt>
                  <dd className="tabular-nums text-[var(--color-brand-fg)]">
                    {short.shortfall.toLocaleString()}
                  </dd>
                </div>
              </dl>

              <Button asChild size="sm" className="mt-3 w-full">
                <Link
                  href={`/wallet?buy=${short.tokenType}&tier=${short.tier}&qty=${short.shortfall}`}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Top up {short.shortfall.toLocaleString()}{' '}
                  {short.shortfall === 1 ? 'token' : 'tokens'}
                </Link>
              </Button>

              <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--color-brand-muted)]">
                Come back and press Renew once the tokens land.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-2 text-[0.75rem] font-medium text-[var(--color-brand-danger)]">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
