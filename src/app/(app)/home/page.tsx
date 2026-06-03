'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bird, Warehouse, Wallet, TrendingUp, Plus, ClipboardList,
  ArrowRight, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { CyclePicker } from '@/components/app/cycle-picker';
import {
  BreedSummaryCard, FeedConsumptionCard, WaterConsumptionCard,
  MortalityCard, VaccinationCard,
} from '@/components/app/cycle-cards';
import { endpoints, type FarmDto, type FlockDto, type PenDto } from '@/lib/api';
import { readUser } from '@/lib/auth';
import { readCurrentFarmId, useCurrentFarmId, writeCurrentFarmId } from '@/lib/farm-context';

/**
 * Dashboard — cycle-aware.
 *
 * The mobile design organises everything around the current cycle. The
 * web translates that by leading the page with a cycle picker, then
 * showing the same cycle-results cards. Farm-level stats sit underneath
 * for quick context.
 *
 * If the farm has no cycles yet, we show a friendly onboarding nudge
 * instead of empty cards.
 */
export default function HomePage() {
  const router = useRouter();
  const user = readUser();

  const farms = useQuery({ queryKey: ['farms'], queryFn: () => endpoints.listFarms() });

  useEffect(() => {
    if (!farms.data) return;
    const current = readCurrentFarmId();
    const first = farms.data.farms[0];
    if (!current && first) writeCurrentFarmId(first.id);
    else if (!first) router.replace('/setup/farm');
  }, [farms.data, router]);

  // Reactive read — re-renders when localStorage flips so the
  // pens/flocks queries below actually fire after first-login
  // bootstrapping (the effect above writes the id; without this
  // hook the component never re-renders and `enabled` stays false).
  const currentFarmId = useCurrentFarmId();
  const farm: FarmDto | undefined =
    farms.data?.farms.find((f) => f.id === currentFarmId) ?? farms.data?.farms[0];

  const pens = useQuery({
    queryKey: ['pens', currentFarmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!currentFarmId,
  });

  const flocks = useQuery({
    queryKey: ['flocks', currentFarmId],
    queryFn: () => endpoints.listFlocks(),
    enabled: !!currentFarmId,
  });

  // Default to most-recently-placed flock as the "current cycle".
  const cycle = useMemo<FlockDto | undefined>(() => {
    const items = flocks.data?.flocks ?? [];
    if (items.length === 0) return undefined;
    return items.slice().sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];
  }, [flocks.data]);

  const totalBirds = (flocks.data?.flocks ?? []).reduce(
    (s, f) => s + (f.currentBirds ?? f.placedBirds ?? 0),
    0,
  );
  const freePens = (pens.data?.pens ?? []).filter((p: PenDto) => p.occupancy?.status !== 'occupied').length;

  return (
    <div className="space-y-5">
      {/* Greeting + cycle picker */}
      <section className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            {pickGreeting()} · {todayLabel()}
          </p>
          <h1 className="mt-1 text-[20px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[22px]">
            {user?.name?.split(' ')[0] ?? 'Welcome'}
            {farm ? ` — ${farm.name}` : ''}
          </h1>
        </div>
        {(flocks.data?.flocks ?? []).length > 0 && (
          <CyclePicker
            cycles={flocks.data?.flocks ?? []}
            pens={pens.data?.pens ?? []}
            currentCycleId={cycle?.id}
          />
        )}
      </section>

      {/* Stat row */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Bird}       label="Active birds" value={totalBirds.toLocaleString()}
                  sub={`Across ${flocks.data?.flocks.length ?? 0} cycles`} tone="mint" />
        <StatCard icon={Warehouse}  label="Pens"         value={pens.data?.pens.length ?? 0}
                  sub={`${freePens} free for placement`} tone="sky" />
        <StatCard icon={TrendingUp} label="Avg FCR"      value="—"
                  sub="Tracks once records flow" tone="amber" />
        <StatCard icon={Wallet}     label="Cost so far"  value="—"
                  sub="Updates as you log expenses" tone="rose" />
      </section>

      {/* Cycle results — same cards as /cycles/[id] */}
      {cycle ? (
        <>
          <PageHeader
            eyebrow="Current cycle"
            title={`Cycle results · ${cycle.breed}`}
            description={`${(cycle.ageDays ?? 0)} days old · ${cycle.placedBirds.toLocaleString()} birds placed`}
            actions={
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href={`/cycles/${cycle.id}`}>
                  Open cycle
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <BreedSummaryCard flock={cycle} />
            <FeedConsumptionCard fcr={null} />
            <WaterConsumptionCard daily={null} />
            <MortalityCard rate={null} />
            <VaccinationCard schedule={[]} />
          </div>
        </>
      ) : (
        <EmptyCycleNudge />
      )}

      {/* Quick add */}
      <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
              Daily logs, FCR &amp; cost analytics coming next
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
              Feed, water, vaccines, mortality — log in seconds, watch your margins grow.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/records">
              <ClipboardList className="h-3.5 w-3.5" />
              Log
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function EmptyCycleNudge() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Bird className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[14px] font-bold text-[var(--color-brand-fg)]">No active cycle yet</p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
        Place your first flock to start tracking feed, vaccines and margin.
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/setup/flocks">
          <Plus className="h-3.5 w-3.5" />
          Place a flock
        </Link>
      </Button>
    </div>
  );
}

function pickGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
