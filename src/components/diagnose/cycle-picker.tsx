'use client';

import { useQuery } from '@tanstack/react-query';
import { Bird, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { endpoints, type FlockDto } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { flocksKey } from '@/lib/query-keys';

/**
 * Which cycle is this check for?
 *
 * REQUIRED, AND ONLY RUNNING CYCLES.
 * ----------------------------------
 * This began as an optional link, on the reasoning that droppings turn
 * up outside a tracked pen and refusing those would withhold the
 * feature when it is most useful. The unlinked checks turned out to be
 * the least useful rows in the table: they cannot go into a report,
 * they give a vet no clinical history to read, and they carry no age,
 * mortality or vaccination context for retraining — which is the whole
 * reason the photographs are kept.
 *
 * Worse, vet consultations were arriving attached to cycles that had
 * ENDED. A vet would open a clinical brief whose mortality,
 * vaccinations and medication all stopped weeks ago, describing birds
 * that are no longer in the pen.
 *
 * So the list is filtered to cycles that still accept writes — the same
 * test the daily-record wizard uses — and the server enforces it
 * regardless of what any client sends.
 *
 * Auto-selects when there is exactly one, which is the common case.
 * Making someone pick from a list of one is a tap that teaches them the
 * app is not paying attention.
 */
export function CyclePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (flockId: string | null) => void;
}) {
  const farmId = useCurrentFarmId();

  const flocks = useQuery({
    queryKey: flocksKey(farmId),
    queryFn: () => endpoints.listFlocks(),
    enabled: !!farmId,
  });

  // Running cycles only. `writeWindow` is optional on older API builds —
  // a missing value is treated as writable rather than locking someone
  // out over a deploy skew between the app and the API.
  const cycles: FlockDto[] = (flocks.data?.flocks ?? []).filter(
    (f) => f.archivedAt == null && (f.writeWindow?.allowsWrites ?? true),
  );

  const only = cycles.length === 1 ? cycles[0] : null;

  // Auto-select the single cycle, and clear a selection that is no
  // longer valid — a cycle can expire while this screen is open, and a
  // stale id would be rejected by the server at submit time with an
  // error the farmer cannot act on.
  useEffect(() => {
    if (only && value !== only.id) {
      onChange(only.id);
      return;
    }
    if (value && !cycles.some((c) => c.id === value)) {
      onChange(null);
    }
  }, [only, value, cycles, onChange]);

  if (flocks.isLoading) {
    return (
      <div className="h-[4.5rem] animate-pulse rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/60" />
    );
  }

  // NOTHING RUNNING. Said plainly, with the way out.
  //
  // This is the real cost of requiring the link: a farm between cycles
  // cannot use the feature at all. A disabled button with no
  // explanation would read as the app being broken, so the state names
  // the reason and links to the fix.
  if (cycles.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
        <p className="text-[0.84375rem] font-bold text-[var(--color-brand-fg)]">
          No running cycle
        </p>
        <p className="mt-1 text-[0.78125rem] leading-relaxed text-[var(--color-brand-muted)]">
          A disease check is saved against a cycle, so a vet can see the birds&rsquo; age,
          mortality and vaccinations alongside your photo. Place a flock first, or renew a
          cycle that has ended.
        </p>
        <Link
          href="/pens-flocks"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-3 py-2 text-[0.78125rem] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Go to pens and flocks
        </Link>
      </div>
    );
  }

  if (only) {
    // One cycle, already selected. Shown rather than hidden so the
    // farmer can see WHICH cycle the result will be filed against —
    // this is now a fact about the check, not an optional extra.
    return (
      <div className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--color-brand-primary)]/35 bg-[var(--color-brand-accent)]/30 p-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary)] text-white">
          <Bird className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-semibold text-[var(--color-brand-fg)]">
            Checking {only.breed}
          </span>
          <span className="block truncate text-[0.71875rem] text-[var(--color-brand-muted)]">
            {(only.currentBirds ?? only.placedBirds).toLocaleString()} birds
            {only.ageDays != null && <> · day {only.ageDays}</>}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-3">
      <label
        htmlFor="diagnose-cycle"
        className="block text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]"
      >
        Which cycle?
      </label>
      <select
        id="diagnose-cycle"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1.5 block h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3 text-[0.8125rem]"
      >
        {/* No "not linked" option any more — the link is required. The
            empty option is a prompt, not a choice. */}
        <option value="">Choose a cycle…</option>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.breed} · {(c.currentBirds ?? c.placedBirds).toLocaleString()} birds
            {c.ageDays != null ? ` · day ${c.ageDays}` : ''}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[0.71875rem] text-[var(--color-brand-muted)]">
        The result is saved to this cycle, and a vet sees its records alongside your photo.
      </p>
    </div>
  );
}
