'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bird, Warehouse, Wallet, TrendingUp, Plus, Syringe, ClipboardList,
  ArrowRight, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { FlockCard } from '@/components/app/flock-card';
import { endpoints, type FarmDto, type FlockDto, type PenDto } from '@/lib/api';
import { readUser } from '@/lib/auth';
import { readCurrentFarmId, writeCurrentFarmId } from '@/lib/farm-context';

/**
 * Dashboard — the landing page after onboarding.
 *
 * Structure:
 *   - Greeting hero with current farm + quick CTAs
 *   - 4-up stat row
 *   - Today's task list (vaccines due, weigh-ins) — placeholder for
 *     when the schedule API ships
 *   - Active flocks grid
 *   - Recent activity feed
 *
 * If user has no farm, route to /setup/farm to close the loop.
 */
export default function HomePage() {
  const router = useRouter();
  const user = readUser();

  const farms = useQuery({ queryKey: ['farms'], queryFn: () => endpoints.listFarms() });

  // Auto-pick first farm if context unset; redirect to setup if none.
  useEffect(() => {
    if (!farms.data) return;
    const current = readCurrentFarmId();
    const first = farms.data.farms[0];
    if (!current && first) writeCurrentFarmId(first.id);
    else if (!first) router.replace('/setup/farm');
  }, [farms.data, router]);

  const currentFarmId = readCurrentFarmId();
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

  const totalBirds = (flocks.data?.flocks ?? []).reduce(
    (s, f) => s + (f.currentBirds ?? f.placedBirds ?? 0),
    0,
  );
  const freePens = (pens.data?.pens ?? []).filter((p: PenDto) => p.occupancy?.status !== 'occupied').length;
  const greeting = pickGreeting();

  return (
    <div className="space-y-8">
      {/* Hero greeting card */}
      <section
        className="relative overflow-hidden rounded-3xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] p-6 text-white sm:p-8"
      >
        {/* Mesh + grain overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(50% 35% at 18% 12%, rgba(167, 243, 194, 0.22) 0%, transparent 60%),
              radial-gradient(40% 28% at 85% 88%, rgba(255, 255, 255, 0.10) 0%, transparent 65%)
            `,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
              {greeting} · {todayLabel()}
            </p>
            <h1
              className="mt-2 font-extrabold leading-tight tracking-tight text-white"
              style={{ fontSize: 'var(--text-hero)' }}
            >
              {user?.name?.split(' ')[0] ?? 'Welcome'}, {farm ? `here's ${farm.name}` : 'set up your farm'}
            </h1>
            {farm && (
              <p className="mt-2 text-base text-white/85">
                {[farm.state, farm.address].filter(Boolean).join(' · ') || 'Set a location in settings to localise alerts.'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" variant="secondary" className="h-12 px-5">
              <Link href="/setup/flocks">
                <Plus className="h-4 w-4" />
                Place flock
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-white/30 bg-white/10 px-5 text-white hover:bg-white/15 hover:text-white">
              <Link href="/records">
                <ClipboardList className="h-4 w-4" />
                Log records
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stat row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Bird}
          label="Active birds"
          value={totalBirds.toLocaleString()}
          sub={`Across ${flocks.data?.flocks.length ?? 0} flocks`}
          tone="mint"
        />
        <StatCard
          icon={Warehouse}
          label="Pens"
          value={pens.data?.pens.length ?? 0}
          sub={`${freePens} free for placement`}
          tone="sky"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg FCR"
          value="—"
          sub="Tracks once records flow"
          tone="amber"
        />
        <StatCard
          icon={Wallet}
          label="Cost so far"
          value="—"
          sub="Updates as you log expenses"
          tone="rose"
        />
      </section>

      {/* Today's tasks */}
      <section>
        <PageHeader
          eyebrow="Today"
          title="What needs doing"
          description="Smart reminders will appear here as your flocks age into their schedules."
        />
        <div className="mt-5 rounded-3xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-6 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Syringe className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm font-bold text-[var(--color-brand-fg)]">
            No tasks scheduled yet
          </p>
          <p className="mt-1 text-xs text-[var(--color-brand-muted)]">
            Once a flock is past day 5, your country-tuned vaccine schedule kicks in here.
          </p>
        </div>
      </section>

      {/* Active flocks */}
      <section>
        <PageHeader
          eyebrow="Flocks"
          title="Active right now"
          actions={
            <Button asChild variant="outline" size="sm" className="h-10">
              <Link href="/flocks">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <div className="mt-5">
          {(flocks.data?.flocks ?? []).length === 0 ? (
            <EmptyFlocks />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(flocks.data?.flocks ?? []).slice(0, 6).map((f: FlockDto) => (
                <FlockCard key={f.id} flock={f} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Coming-soon banner */}
      <section className="overflow-hidden rounded-3xl border border-[var(--color-brand-border)] bg-white p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--color-brand-fg)]">
                Daily logs, FCR & cost analytics coming next
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-brand-muted)]">
                Feed, water, vaccines, mortality — log in seconds, watch your margins grow.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyFlocks() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Bird className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-bold text-[var(--color-brand-fg)]">No flocks placed yet</p>
      <p className="mt-1 text-xs text-[var(--color-brand-muted)]">
        Place your first flock to start tracking feed, vaccines, and margin.
      </p>
      <Button asChild size="lg" className="mt-5 h-12 px-5">
        <Link href="/setup/flocks">
          <Plus className="h-4 w-4" />
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
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
