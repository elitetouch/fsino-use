'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Tractor, Plus, MapPin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { canCreateFarm, endpoints, type FarmDto } from '@/lib/api';
import { readCurrentFarmId, writeCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

export default function FarmsPage() {
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => endpoints.listFarms() });
  const current = readCurrentFarmId();
  // Mirror the backend authorization — invited staff can only switch
  // between farms they belong to, not start new ones.
  const allowedToCreate = canCreateFarm(farms.data?.farms);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Farms"
        title="Your farms"
        description={
          allowedToCreate
            ? 'Switch between your farms or add a new one.'
            : 'Switch between the farms you belong to.'
        }
        actions={
          allowedToCreate ? (
            <Button asChild size="sm" className="h-10">
              <Link href="/setup/farm">
                <Plus className="h-4 w-4" />
                New farm
              </Link>
            </Button>
          ) : undefined
        }
      />

      {farms.isLoading ? (
        <Skeleton />
      ) : (farms.data?.farms ?? []).length === 0 ? (
        <Empty />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {farms.data?.farms.map((f) => (
            <FarmCard key={f.id} farm={f} active={f.id === current} />
          ))}
        </div>
      )}
    </div>
  );
}

function FarmCard({ farm, active }: { farm: FarmDto; active: boolean }) {
  return (
    <button
      type="button"
      onClick={() => { writeCurrentFarmId(farm.id); window.location.href = '/home'; }}
      className={cn(
        'group block text-left overflow-hidden rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_rgba(15,80,30,0.20)]',
        active
          ? 'border-[var(--color-brand-primary)] ring-1 ring-[var(--color-brand-primary)]/40'
          : 'border-[var(--color-brand-border)] hover:border-[var(--color-brand-primary)]/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Tractor className="h-5 w-5" strokeWidth={2.2} />
        </span>
        {active && (
          <span className="rounded-full bg-[var(--color-brand-primary)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Current
          </span>
        )}
      </div>
      <p className="mt-4 text-lg font-bold tracking-tight text-[var(--color-brand-fg)]">{farm.name}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-brand-muted)]">
        <MapPin className="h-3 w-3" />
        {[farm.state, farm.address].filter(Boolean).join(' · ') || 'No location set'}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--color-brand-border)] pt-4 text-center">
        <div>
          <p className="text-base font-bold text-[var(--color-brand-fg)]">{farm.farmStat?.activePensCount ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">Pens</p>
        </div>
        <div>
          <p className="text-base font-bold text-[var(--color-brand-fg)]">{farm.farmStat?.activeFlocksCount ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">Flocks</p>
        </div>
        <div>
          <p className="text-base font-bold text-[var(--color-brand-fg)]">{farm.estimatedCapacity?.toLocaleString() ?? '—'}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">Capacity</p>
        </div>
      </div>
      {/* Manage link — escape hatch to the farm-detail / edit page.
          Rendered as a span (not a nested anchor) so it doesn't violate
          the outer <button>'s "no interactive children" rule, and uses
          stopPropagation so a tap on "Manage" doesn't also trigger the
          farm-switch the parent button performs. */}
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          window.location.href = `/farms/${farm.id}`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = `/farms/${farm.id}`;
          }
        }}
        className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
      >
        <Settings className="h-3 w-3" />
        Manage farm
      </span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-12 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Tractor className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-bold text-[var(--color-brand-fg)]">No farms yet</p>
      <Button asChild size="lg" className="mt-5">
        <Link href="/setup/farm"><Plus className="h-4 w-4" /> Set up a farm</Link>
      </Button>
    </div>
  );
}
