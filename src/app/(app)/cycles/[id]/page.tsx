'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Calendar, MapPin, Plus, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CyclePicker } from '@/components/app/cycle-picker';
import {
  BreedSummaryCard, FeedConsumptionCard, WaterConsumptionCard,
  MortalityCard, EggCollectionCard, VaccinationCard,
} from '@/components/app/cycle-cards';
import { endpoints, type FlockDto, type PenDto } from '@/lib/api';
import { readCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

type Tab = 'results' | 'climate' | 'finance';

/**
 * Cycle results — the live dashboard for one selected cycle (flock).
 *
 * Layout:
 *   - Dark green header strip with back link, picker, and tabs
 *     (Cycle results / Pen climate / Finance) mirroring the mobile bar.
 *   - Below the strip: cycle metadata row + 6-card grid in 2 columns
 *     on lg.
 *
 * Backend-data cards that don't yet have a feed render empty states so
 * the layout stays world-class while real numbers are wired in.
 */
export default function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const farmId = readCurrentFarmId();
  const [tab, setTab] = useState<Tab>('results');

  const flocks = useQuery({
    queryKey: ['flocks', farmId],
    queryFn: () => endpoints.listFlocks(),
    enabled: !!farmId,
  });

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  const cycle = (flocks.data?.flocks ?? []).find((f) => f.id === id);
  const pen: PenDto | undefined = (pens.data?.pens ?? []).find((p) => p.id === cycle?.penId);
  const allCycles: FlockDto[] = flocks.data?.flocks ?? [];
  const ordinal = Math.max(1, allCycles.findIndex((c) => c.id === id) + 1);

  return (
    <div className="space-y-5">
      {/* Header strip — the dark-green "Cycle results" bar from mobile. */}
      <section className="overflow-hidden rounded-xl bg-[var(--color-brand-primary-dark)] text-white shadow-[0_10px_30px_-15px_rgba(15,80,30,0.40)]">
        <div className="px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/cycles"
              aria-label="All cycles"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <p className="text-[14px] font-bold tracking-tight">Cycle results</p>
            <div aria-hidden className="h-8 w-8" />
          </div>

          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <CyclePicker
              cycles={allCycles}
              pens={pens.data?.pens ?? []}
              currentCycleId={id}
            />
            {/* Tab strip */}
            <div className="flex rounded-md bg-black/15 p-0.5">
              {[
                { key: 'results',  label: 'Cycle results' },
                { key: 'climate',  label: 'Pen climate' },
                { key: 'finance',  label: 'Finance' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key as Tab)}
                  className={cn(
                    'rounded-[5px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                    tab === t.key
                      ? 'bg-white text-[var(--color-brand-primary-dark)]'
                      : 'text-white/85 hover:text-white',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      {flocks.isLoading ? (
        <CardSkeleton />
      ) : !cycle ? (
        <NotFound />
      ) : tab === 'climate' ? (
        <PlaceholderTab title="Pen climate" body="Connect a climate sensor to see temperature, humidity and CO2 trends for this pen." />
      ) : tab === 'finance' ? (
        <PlaceholderTab title="Finance" body="Track feed cost, vaccine cost and projected margin for this cycle here." />
      ) : (
        <ResultsTab cycle={cycle} pen={pen} ordinal={ordinal} />
      )}
    </div>
  );
}

function ResultsTab({
  cycle,
  pen,
  ordinal,
}: {
  cycle: FlockDto;
  pen?: PenDto;
  ordinal: number;
}) {
  const completedDate = cycle.validUntil ?? cycle.startDate;
  return (
    <>
      {/* Cycle meta row */}
      <article className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Calendar className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">Cycle {ordinal}</p>
            <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">
              Started {cycle.startDate}
              {completedDate && completedDate !== cycle.startDate ? ` · ends ${completedDate}` : ''}
              {pen && (
                <>
                  {' · '}<MapPin className="inline h-3 w-3" /> {pen.name}
                </>
              )}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--color-brand-muted-soft)]" />
      </article>

      {/* 2-up card grid */}
      <div className="grid gap-3 lg:grid-cols-2">
        <BreedSummaryCard flock={cycle} />
        <FeedConsumptionCard fcr={null} />
        <WaterConsumptionCard daily={null} />
        <MortalityCard rate={null} />
        {cycle.productionType === 'layer' && <EggCollectionCard daily={null} />}
        <VaccinationCard schedule={[]} />
      </div>

      {/* Quick-add row */}
      <section className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">Add today&rsquo;s record</p>
            <p className="text-[11.5px] text-[var(--color-brand-muted)]">
              Log feed, water, mortality and vaccines for this cycle.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/records">
              <Plus className="h-3.5 w-3.5" />
              Add record
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{title} — coming soon</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] text-[var(--color-brand-muted)]">{body}</p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-white" />
      ))}
    </div>
  );
}

function NotFound() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">Cycle not found</p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
        It may have been archived. Pick another cycle.
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/cycles">Back to cycles</Link>
      </Button>
    </div>
  );
}
