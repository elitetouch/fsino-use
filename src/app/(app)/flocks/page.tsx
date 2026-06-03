'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bird, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { FlockCard } from '@/components/app/flock-card';
import { endpoints, type FlockDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { readCurrentFarmId } from '@/lib/farm-context';

export default function FlocksPage() {
  const farmId = readCurrentFarmId();
  const flocks = useQuery({
    queryKey: ['flocks', farmId],
    queryFn: () => endpoints.listFlocks(),
    enabled: !!farmId,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Flocks"
        title="All flocks"
        description="Every flock you have placed — active and past cycles."
        actions={
          <Gate perm="flocks.create">
            <Button asChild size="sm" className="h-10">
              <Link href="/setup/flocks">
                <Plus className="h-4 w-4" />
                Place flock
              </Link>
            </Button>
          </Gate>
        }
      />

      {flocks.isLoading ? (
        <SkeletonGrid />
      ) : (flocks.data?.flocks ?? []).length === 0 ? (
        <Empty />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(flocks.data?.flocks ?? []).map((f: FlockDto) => (
            <FlockCard key={f.id} flock={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-12 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Bird className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-bold text-[var(--color-brand-fg)]">No flocks yet</p>
      <p className="mt-1 text-xs text-[var(--color-brand-muted)]">Place your first flock to start tracking it.</p>
      <Gate perm="flocks.create">
        <Button asChild size="lg" className="mt-5">
          <Link href="/setup/flocks">
            <Plus className="h-4 w-4" /> Place a flock
          </Link>
        </Button>
      </Gate>
    </div>
  );
}
