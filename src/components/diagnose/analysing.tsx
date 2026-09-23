'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

/**
 * The wait.
 *
 * Inference takes about nine seconds on the production CPU, and nine
 * seconds of an undifferentiated spinner is long enough that people
 * assume it has hung and leave — which on a metered mobile connection
 * means they have paid for a diagnosis they never saw.
 *
 * So the wait is narrated in stages that correspond to what is ACTUALLY
 * happening server-side: validation and the safety guards, then the
 * network forward pass, then Grad-CAM. Each completed stage stays on
 * screen with a tick. Progress you can see is progress you will wait
 * for; a spinner is not.
 *
 * The timings are approximate and deliberately do not claim precision —
 * the last stage holds indefinitely rather than pretending to finish,
 * because a progress bar that reaches 100% and then keeps spinning is
 * worse than no progress bar at all.
 */

const STAGES = [
  { at: 0, label: 'Checking the photo' },
  { at: 2200, label: 'Comparing against known cases' },
  { at: 6500, label: 'Preparing your result' },
] as const;

export function Analysing({ preview }: { preview: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.map((s, i) =>
      s.at === 0 ? null : setTimeout(() => setStage(i), s.at),
    );

    return () => timers.forEach((t) => t && clearTimeout(t));
  }, []);

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="flex flex-col items-center text-center">
        {/* The farmer's own photo, so it is obvious WHICH image is being
            examined — and it gives the eye something to rest on that is
            recognisably theirs rather than a generic animation. */}
        <div className="relative h-36 w-36 overflow-hidden rounded-xl border border-[var(--color-brand-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 animate-pulse bg-[var(--color-brand-primary)]/10" />
        </div>

        <p className="mt-4 text-[15px] font-bold text-[var(--color-brand-fg)]">
          Examining your photo
        </p>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-brand-muted)]">
          This takes about 10 seconds. Keep this screen open.
        </p>
      </div>

      <ul className="mt-5 space-y-2.5">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;

          return (
            <li key={s.label} className="flex items-center gap-2.5">
              <span
                className={[
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  done
                    ? 'bg-[var(--color-brand-primary)] text-white'
                    : active
                      ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                      : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted-soft)]',
                ].join(' ')}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={3} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={[
                  'text-[13px]',
                  done || active
                    ? 'font-semibold text-[var(--color-brand-fg)]'
                    : 'text-[var(--color-brand-muted)]',
                ].join(' ')}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
