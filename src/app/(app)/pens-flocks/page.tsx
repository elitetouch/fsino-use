'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Warehouse, Bird } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { FlockCard } from '@/components/app/flock-card';
import { endpoints, type PenDto, type FlockDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { readCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

type Tab = 'pens' | 'flocks';

/**
 * Pens and flocks — combined view for the IA group of the same name.
 *
 * Two tabs above the content: Pens (the physical houses) and Flocks
 * (the cycles of birds). Both lists are clickable and pre-route to
 * their respective detail pages.
 */
export default function PensFlocksPage() {
  const farmId = readCurrentFarmId();
  const [tab, setTab] = useState<Tab>('pens');

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  const flocks = useQuery({
    queryKey: ['flocks', farmId],
    queryFn: () => endpoints.listFlocks(),
    enabled: !!farmId,
  });

  const penCount = pens.data?.pens.length ?? 0;
  const flockCount = flocks.data?.flocks.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Pens and flocks"
        description="The physical pens you run and the cycles of birds inside them."
        actions={
          <div className="flex items-center gap-2">
            <Gate perm="pens.create">
              <Button asChild variant="outline" size="sm" className="h-10">
                <Link href="/setup/pens">
                  <Plus className="h-3.5 w-3.5" />
                  New pen
                </Link>
              </Button>
            </Gate>
            <Gate perm="flocks.create">
              <Button asChild size="sm" className="h-10">
                <Link href="/setup/flocks">
                  <Plus className="h-3.5 w-3.5" />
                  Place flock
                </Link>
              </Button>
            </Gate>
          </div>
        }
      />

      {/* Tab strip */}
      <div className="inline-flex rounded-lg bg-[var(--color-brand-surface-soft)] p-0.5">
        <TabButton
          active={tab === 'pens'}
          onClick={() => setTab('pens')}
          icon={Warehouse}
          label="Pens"
          count={penCount}
        />
        <TabButton
          active={tab === 'flocks'}
          onClick={() => setTab('flocks')}
          icon={Bird}
          label="Flocks"
          count={flockCount}
        />
      </div>

      {tab === 'pens' ? (
        <PensView pens={pens.data?.pens ?? []} loading={pens.isLoading} />
      ) : (
        <FlocksView flocks={flocks.data?.flocks ?? []} loading={flocks.isLoading} />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Warehouse;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
        active
          ? 'bg-white text-[var(--color-brand-fg)] shadow-sm'
          : 'text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className={cn(
        'ml-0.5 rounded-full px-1.5 text-[10px] font-bold',
        active ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]' : 'bg-[var(--color-brand-border)] text-[var(--color-brand-muted)]',
      )}>
        {count}
      </span>
    </button>
  );
}

function PensView({ pens, loading }: { pens: PenDto[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    );
  }
  if (pens.length === 0) {
    return (
      <Empty
        icon={Warehouse}
        title="No pens yet"
        body="A pen is a house, cage or section where a flock lives."
        ctaHref="/setup/pens"
        ctaLabel="Add a pen"
        ctaPerm="pens.create"
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pens.map((pen) => {
        const occupied = pen.occupancy?.status === 'occupied';
        return (
          <Link
            key={pen.id}
            href={`/pens/${pen.id}`}
            className="group block overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_8px_24px_-12px_rgba(15,80,30,0.10)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
                <Warehouse className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                occupied ? 'bg-amber-50 text-amber-700' : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
              )}>
                {occupied ? 'Occupied' : 'Free'}
              </span>
            </div>
            <p className="mt-3 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">{pen.name}</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
              {pen.penType ? pen.penType.replace(/_/g, ' ') : 'No type'}
              {pen.capacity ? ` · capacity ${pen.capacity.toLocaleString()}` : ''}
            </p>
            {occupied && pen.occupancy?.activeFlock && (
              <p className="mt-2 truncate text-[11.5px] text-[var(--color-brand-muted)]">
                <strong className="text-[var(--color-brand-fg)]">
                  {pen.occupancy.activeFlock.name ?? pen.occupancy.activeFlock.productionType}
                </strong>
                {' · '}{pen.occupancy.activeFlock.currentBirds.toLocaleString()} birds
              </p>
            )}
            <p className="mt-3 text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] transition-transform group-hover:translate-x-0.5">
              View cycle history →
            </p>
          </Link>
        );
      })}
    </div>
  );
}

function FlocksView({ flocks, loading }: { flocks: FlockDto[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    );
  }
  if (flocks.length === 0) {
    return (
      <Empty
        icon={Bird}
        title="No active flocks"
        body="Place a flock in a pen to start a new cycle."
        ctaHref="/setup/flocks"
        ctaLabel="Place a flock"
        ctaPerm="flocks.create"
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {flocks.map((f) => <FlockCard key={f.id} flock={f} />)}
    </div>
  );
}

function Empty({
  icon: Icon, title, body, ctaHref, ctaLabel, ctaPerm,
}: {
  icon: typeof Warehouse;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
  /** Only show the create-CTA if the user has this permission. */
  ctaPerm: 'pens.create' | 'flocks.create';
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">{body}</p>
      <Gate perm={ctaPerm}>
        <Button asChild size="sm" className="mt-4 h-9">
          <Link href={ctaHref}>
            <Plus className="h-3.5 w-3.5" />
            {ctaLabel}
          </Link>
        </Button>
      </Gate>
    </div>
  );
}
