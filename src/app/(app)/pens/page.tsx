'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Warehouse, Plus, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { endpoints, type PenDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { readCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

export default function PensPage() {
  const farmId = readCurrentFarmId();
  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pens"
        title="All pens"
        description="Houses, cages and sections that hold your flocks."
        actions={
          <Gate perm="pens.create">
            <Button asChild size="sm" className="h-10">
              <Link href="/setup/pens">
                <Plus className="h-4 w-4" />
                Add pen
              </Link>
            </Button>
          </Gate>
        }
      />

      {pens.isLoading ? (
        <Skeleton />
      ) : (pens.data?.pens ?? []).length === 0 ? (
        <Empty />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(pens.data?.pens ?? []).map((p: PenDto) => <PenCard key={p.id} pen={p} />)}
        </div>
      )}
    </div>
  );
}

function PenCard({ pen }: { pen: PenDto }) {
  const occupied = pen.occupancy?.status === 'occupied';
  return (
    <Link
      href={`/pens/${pen.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_20px_50px_-25px_rgba(15,80,30,0.20)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
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
      <p className="mt-4 text-lg font-bold tracking-tight text-[var(--color-brand-fg)]">{pen.name}</p>
      <p className="mt-0.5 text-xs text-[var(--color-brand-muted)]">
        {pen.penType ? pen.penType.replace(/_/g, ' ') : 'No type'}
        {pen.capacity ? ` · capacity ${pen.capacity.toLocaleString()}` : ''}
      </p>
      {occupied && pen.occupancy?.activeFlock && (
        <p className="mt-3 text-xs text-[var(--color-brand-muted)]">
          <strong className="text-[var(--color-brand-fg)]">
            {pen.occupancy.activeFlock.name ?? pen.occupancy.activeFlock.productionType}
          </strong>
          {' '}· {pen.occupancy.activeFlock.currentBirds.toLocaleString()} birds
        </p>
      )}
      <p className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-primary-deep)] transition-transform group-hover:translate-x-0.5">
        View cycle history →
      </p>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-12 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Warehouse className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-bold text-[var(--color-brand-fg)]">No pens yet</p>
      <p className="mt-1 text-xs text-[var(--color-brand-muted)]">Add a pen so you have somewhere to place flocks.</p>
      <Gate perm="pens.create">
        <Button asChild size="lg" className="mt-5">
          <Link href="/setup/pens">
            <Plus className="h-4 w-4" /> Add a pen
          </Link>
        </Button>
      </Gate>
    </div>
  );
}
