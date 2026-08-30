'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bird, Search, Plus, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { endpoints, type FlockDto, type PenDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/format';
import { flocksKey } from '@/lib/query-keys';

/**
 * Select cycle — the web equivalent of the mobile "Select pen → Select
 * cycle" pair. We collapse it into one screen with a pen filter so the
 * desktop user can scan everything at once.
 */
export default function CyclesPage() {
  const farmId = useCurrentFarmId();
  const [q, setQ] = useState('');
  const [penId, setPenId] = useState<string>('all');
  // Defaults to 'all' so a farm whose only cycle is finished doesn't
  // land on "No cycles yet" and conclude its data is gone.
  const [status, setStatus] = useState<'all' | 'active' | 'completed'>('all');

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  // Includes completed cycles. This page is how a farmer reaches a
  // finished cycle's results and report — with an active-only list,
  // a farm between cycles saw "No cycles yet" and had no route to its
  // own history at all.
  const flocks = useQuery({
    queryKey: flocksKey(farmId, { includeArchived: true }),
    queryFn: () => endpoints.listFlocks({ includeArchived: true }),
    enabled: !!farmId,
  });

  const all = flocks.data?.flocks ?? [];
  const activeCount = all.filter((c) => c.archivedAt == null).length;
  const completedCount = all.length - activeCount;

  const cycles: FlockDto[] = all
    .filter((c) => (penId === 'all' ? true : c.penId === penId))
    .filter((c) => (q ? c.breed.toLowerCase().includes(q.toLowerCase()) : true))
    .filter((c) => {
      if (status === 'active') return c.archivedAt == null;
      if (status === 'completed') return c.archivedAt != null;
      return true;
    })
    // Running cycles first — those are the ones needing daily action —
    // then newest-started within each group.
    .sort((a, b) => {
      const aArchived = a.archivedAt != null ? 1 : 0;
      const bArchived = b.archivedAt != null ? 1 : 0;
      if (aArchived !== bArchived) return aArchived - bArchived;
      return (b.startDate ?? '').localeCompare(a.startDate ?? '');
    });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cycles"
        title="Select a cycle"
        description="Open a cycle to see its results, climate and finances."
        actions={
          <Gate perm="flocks.create">
            <Button asChild size="sm">
              <Link href="/setup/flocks">
                <Plus className="h-3.5 w-3.5" />
                Place flock
              </Link>
            </Button>
          </Gate>
        }
      />

      {/* Filters bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-brand-muted)]" />
          <Input
            placeholder="Search by breed…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 pl-9 text-[13px]"
          />
        </div>
        <div className="relative sm:w-[220px]">
          <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-brand-muted)]" />
          <select
            value={penId}
            onChange={(e) => setPenId(e.target.value)}
            className="block h-10 w-full appearance-none rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white pl-9 pr-3 text-[13px]"
          >
            <option value="all">All pens</option>
            {(pens.data?.pens ?? []).map((p: PenDto) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="relative sm:w-[200px]">
          <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-brand-muted)]" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'completed')}
            aria-label="Filter by cycle status"
            className="block h-10 w-full appearance-none rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white pl-9 pr-3 text-[13px]"
          >
            <option value="all">All cycles ({all.length})</option>
            <option value="active">Running ({activeCount})</option>
            <option value="completed">Completed ({completedCount})</option>
          </select>
        </div>
      </div>

      {/* List */}
      {flocks.isLoading ? (
        <SkeletonList />
      ) : cycles.length === 0 ? (
        <Empty filtered={all.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
          {cycles.map((c, i) => (
            <CycleRow
              key={c.id}
              cycle={c}
              ordinal={i + 1}
              pens={pens.data?.pens ?? []}
              divider={i < cycles.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CycleRow({
  cycle,
  ordinal,
  pens,
  divider,
}: {
  cycle: FlockDto;
  ordinal: number;
  pens: PenDto[];
  divider: boolean;
}) {
  const pen = pens.find((p) => p.id === cycle.penId);
  const isArchived = cycle.archivedAt != null;
  const days = cycle.ageDays ?? 0;

  // A finished cycle is described by how it ended, not by how old it
  // got. The age label reads as if the cycle were still running.
  const status = isArchived
    ? fmtDate(cycle.archivedAt)
    : days <= 0
      ? 'Just placed'
      : days < 42
        ? `${days} days old`
        : `Cycle complete · ${days}d`;

  return (
    <Link
      href={`/cycles/${cycle.id}`}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-brand-surface-soft)]',
        divider && 'border-b border-[var(--color-brand-border)]',
      )}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Bird className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-[var(--color-brand-fg)]">
          Cycle {ordinal} · {cycle.breed}
        </p>
        <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">
          {pen ? `${pen.name} · ` : ''}{labelForProduction(cycle.productionType)} · {cycle.placedBirds.toLocaleString()} birds
        </p>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        {isArchived && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-muted)]">
            Completed
          </span>
        )}
        <span className="text-[11px] font-semibold text-[var(--color-brand-muted)]">
          {status}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-muted-soft)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-primary-deep)]" />
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cn('h-14 animate-pulse bg-[var(--color-brand-surface-soft)]', i < 3 && 'border-b border-[var(--color-brand-border)]')} />
      ))}
    </div>
  );
}

/**
 * `filtered` means the farm HAS cycles but the current search/pen/status
 * filters exclude them all. Saying "No cycles yet" there tells a farmer
 * their records are gone when they are one dropdown away.
 */
function Empty({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Bird className="h-4 w-4" />
      </span>
      <p className="mt-4 text-[13px] font-bold text-[var(--color-brand-fg)]">
        {filtered ? 'No cycles match these filters' : 'No cycles yet'}
      </p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
        {filtered
          ? 'Try clearing the search, pen or status filter.'
          : 'Place a flock to start a new cycle.'}
      </p>
      {!filtered && (
        <Gate perm="flocks.create">
          <Button asChild size="sm" className="mt-4">
            <Link href="/setup/flocks">
              <Plus className="h-3.5 w-3.5" /> Place a flock
            </Link>
          </Button>
        </Gate>
      )}
    </div>
  );
}

function labelForProduction(t: FlockDto['productionType']): string {
  return t === 'broiler' ? 'Broiler' : t === 'layer' ? 'Layer' : 'Dual-purpose';
}
