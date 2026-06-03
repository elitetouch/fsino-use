'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Warehouse, Bird, ChevronRight, Plus, Check, Lock, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { endpoints, type FlockDto, type PenDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { readCurrentFarmId } from '@/lib/farm-context';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Pen detail — shows the pen's metadata + its full cycle history.
 *
 * Mirrors the mobile "Select pen → Select cycle" flow but on one
 * screen: header card (pen name, type, capacity, status), then the
 * cycles list with the active cycle first followed by completed ones,
 * ordered newest-to-oldest. Each row is a link to the cycle's results
 * page so the user can drill in.
 *
 * If a pen has no cycles yet, we show a "Place a flock here" prompt
 * that pre-routes to /setup/flocks (the inline pen creator already
 * means they won't be making a new pen just to place a flock).
 */
export default function PenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const farmId = readCurrentFarmId();

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  // Full pen history (active + archived) ordered active-first by the
  // backend.
  const history = useQuery({
    queryKey: ['flocks', 'pen', id, 'history'],
    queryFn: () => endpoints.listFlocks({ pen_id: id, includeArchived: true }),
    enabled: !!farmId && !!id,
  });

  const pen: PenDto | undefined = pens.data?.pens.find((p) => p.id === id);
  const cycles: FlockDto[] = history.data?.flocks ?? [];

  const active = useMemo(
    () => cycles.find((c) => c.isActive !== false && !c.archivedAt),
    [cycles],
  );
  const past = useMemo(
    () => cycles.filter((c) => c.archivedAt || c.isActive === false),
    [cycles],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pens"
        title={pen ? pen.name : 'Pen'}
        description={
          pen
            ? `${pen.penType ? pen.penType.replace(/_/g, ' ') : 'No type'}${pen.capacity ? ` · capacity ${pen.capacity.toLocaleString()}` : ''}`
            : 'Loading…'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/pens">
                <ArrowLeft className="h-3.5 w-3.5" />
                All pens
              </Link>
            </Button>
            {!active && pen && (
              <Gate perm="flocks.create">
                <Button asChild size="sm" className="h-9">
                  <Link href="/setup/flocks">
                    <Plus className="h-3.5 w-3.5" />
                    Place flock
                  </Link>
                </Button>
              </Gate>
            )}
          </div>
        }
      />

      {/* Pen status card */}
      {pen && <PenStatusCard pen={pen} active={active} />}

      {/* Active cycle */}
      {active && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
            Active cycle
          </h2>
          <CycleRow cycle={active} ordinal={cycles.length - past.length} />
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
          <History className="h-3.5 w-3.5" />
          Cycle history
          {past.length > 0 && (
            <span className="ml-1 rounded-full bg-[var(--color-brand-surface-soft)] px-1.5 text-[10px] font-bold text-[var(--color-brand-muted)]">
              {past.length}
            </span>
          )}
        </h2>

        {history.isLoading ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn('h-14 animate-pulse bg-[var(--color-brand-surface-soft)]', i < 2 && 'border-b border-[var(--color-brand-border)]')} />
            ))}
          </div>
        ) : past.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-8 text-center">
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">No completed cycles yet</p>
            <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
              Once a cycle here is archived it&rsquo;ll show up below — newest first.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
            {past.map((c, i) => (
              <CycleRow
                key={c.id}
                cycle={c}
                ordinal={past.length - i}
                divider={i < past.length - 1}
                completed
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PenStatusCard({ pen, active }: { pen: PenDto; active?: FlockDto }) {
  const occupied = !!active;
  return (
    <article className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Warehouse className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
            occupied
              ? 'bg-amber-50 text-amber-700'
              : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
          )}
        >
          {occupied ? <Lock className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          {occupied ? 'Occupied' : 'Free'}
        </span>
      </div>

      {active ? (
        <p className="mt-4 text-[13px] text-[var(--color-brand-muted)]">
          Currently housing{' '}
          <strong className="text-[var(--color-brand-fg)]">
            {active.breed} · {active.placedBirds.toLocaleString()} birds
          </strong>
          {' '}— day {active.ageDays ?? 0} of cycle.
        </p>
      ) : (
        <p className="mt-4 text-[13px] text-[var(--color-brand-muted)]">
          This pen is free. Place a flock to start a new cycle here.
        </p>
      )}
    </article>
  );
}

function CycleRow({
  cycle,
  ordinal,
  divider = false,
  completed = false,
}: {
  cycle: FlockDto;
  ordinal: number;
  divider?: boolean;
  completed?: boolean;
}) {
  const completedDate = cycle.archivedAt ?? cycle.validUntil;
  const birds = cycle.currentBirds ?? cycle.placedBirds;

  return (
    <Link
      href={`/cycles/${cycle.id}`}
      className={cn(
        'group flex items-center gap-3 transition-colors',
        completed
          ? cn('px-4 py-3 hover:bg-[var(--color-brand-surface-soft)]', divider && 'border-b border-[var(--color-brand-border)]')
          : 'rounded-xl border border-[var(--color-brand-border)] bg-white px-4 py-3.5 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_8px_24px_-12px_rgba(15,80,30,0.10)]',
      )}
    >
      <span className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        completed
          ? 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]'
          : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
      )}>
        <Bird className="h-4 w-4" strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-[var(--color-brand-fg)]">
          Cycle {ordinal} · {cycle.breed}
        </p>
        <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">
          {labelForProduction(cycle.productionType)} · {birds.toLocaleString()} birds
        </p>
      </div>

      <div className="hidden text-right sm:block">
        {completed ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">
              Completed
            </p>
            <p className="text-[12.5px] text-[var(--color-brand-fg-soft)]">{fmtDate(completedDate)}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
              Day {cycle.ageDays ?? 0}
            </p>
            <p className="text-[12.5px] text-[var(--color-brand-fg-soft)]">started {fmtDate(cycle.startDate)}</p>
          </>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-muted-soft)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-primary-deep)]" />
    </Link>
  );
}

function labelForProduction(t: FlockDto['productionType']): string {
  return t === 'broiler' ? 'Broiler' : t === 'layer' ? 'Layer' : 'Dual-purpose';
}
