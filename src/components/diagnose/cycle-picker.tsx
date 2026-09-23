'use client';

import { useQuery } from '@tanstack/react-query';
import { Bird } from 'lucide-react';
import { endpoints, type FlockDto } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { flocksKey } from '@/lib/query-keys';

/**
 * Which cycle is this check for?
 *
 * ATTACHING IS WHAT MAKES IT USEFUL LATER. An unattached check is a
 * one-off answer that vanishes into history; attached, it can go into
 * the cycle report and sit beside the mortality and treatment records
 * for the same weeks.
 *
 * But it stays OPTIONAL, and that is deliberate. A farmer may photograph
 * droppings found outside any tracked pen, or in a pen whose cycle has
 * closed, and refusing to diagnose that would withhold the feature at
 * exactly the moment it is most useful — when something unexpected has
 * turned up.
 *
 * Auto-selects when there is only one running cycle, which is the common
 * case. Making someone pick from a list of one is a tap that teaches
 * them the app does not pay attention.
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

  const cycles: FlockDto[] = (flocks.data?.flocks ?? []).filter((f) => f.archivedAt == null);

  // Nothing running — say nothing. A farm between cycles can still use
  // the tool, and an empty dropdown would only raise a question it
  // cannot answer.
  if (flocks.isLoading || cycles.length === 0) return null;

  const only = cycles.length === 1 ? cycles[0] : null;

  if (only) {
    const attached = value === only.id;

    return (
      <button
        type="button"
        onClick={() => onChange(attached ? null : only.id)}
        aria-pressed={attached}
        className={[
          'flex w-full items-center gap-2.5 rounded-xl border p-3 text-left transition-colors',
          attached
            ? 'border-[var(--color-brand-primary)]/35 bg-[var(--color-brand-accent)]/30'
            : 'border-[var(--color-brand-border)] bg-white',
        ].join(' ')}
      >
        <span
          className={[
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            attached
              ? 'bg-[var(--color-brand-primary)] text-white'
              : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]',
          ].join(' ')}
        >
          <Bird className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-semibold text-[var(--color-brand-fg)]">
            {attached ? 'For this cycle' : 'Not linked to a cycle'}
          </span>
          <span className="block truncate text-[0.71875rem] text-[var(--color-brand-muted)]">
            {only.breed} · {only.placedBirds.toLocaleString()} birds
          </span>
        </span>
        <span className="shrink-0 text-[0.71875rem] font-semibold text-[var(--color-brand-primary-deep)]">
          {attached ? 'Unlink' : 'Link'}
        </span>
      </button>
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
        <option value="">Not linked to a cycle</option>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.breed} · {c.placedBirds.toLocaleString()} birds
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[0.71875rem] text-[var(--color-brand-muted)]">
        Linking lets you add the result to that cycle&rsquo;s report.
      </p>
    </div>
  );
}
