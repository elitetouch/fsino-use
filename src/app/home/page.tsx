'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bird, Warehouse, Plus, LogOut, Sparkles } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { clearToken, readToken, readUser } from '@/lib/auth';
import { endpoints, type FarmDto, type PenDto, type FlockDto } from '@/lib/api';
import { readCurrentFarmId, writeCurrentFarmId } from '@/lib/farm-context';

/**
 * Placeholder dashboard — the entry point once onboarding is done.
 *
 * For this turn it shows: the current farm's stats, pens, flocks, and
 * sign-out. The full dashboard (daily-log shortcuts, FCR card, vaccine
 * reminders, etc.) is a separate sprint — this page is the stub the
 * setup flow lands you on so the loop is closed end-to-end.
 *
 * If there's no farm context, it bounces to /setup/farm so a user who
 * hits /home with a fresh account still gets the right next step.
 */
export default function HomePage() {
  const router = useRouter();
  const user = readUser();

  useEffect(() => {
    if (!readToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const farms = useQuery({
    queryKey: ['farms'],
    queryFn: () => endpoints.listFarms(),
  });

  // Auto-pick a current farm if we have one but no context set.
  useEffect(() => {
    if (!farms.data) return;
    const current = readCurrentFarmId();
    const first = farms.data.farms[0];
    if (!current && first) {
      writeCurrentFarmId(first.id);
    } else if (!first) {
      router.replace('/setup/farm');
    }
  }, [farms.data, router]);

  const currentFarmId = readCurrentFarmId();
  const farm: FarmDto | undefined = farms.data?.farms.find((f) => f.id === currentFarmId)
    ?? farms.data?.farms[0];

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

  function signOut() {
    clearToken();
    writeCurrentFarmId(null);
    router.replace('/');
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-surface-soft)]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-brand-border)] bg-white/85 backdrop-blur-lg">
        <div
          className="mx-auto flex h-16 items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-8 lg:px-12"
          style={{ maxWidth: 'var(--container-page)' }}
        >
          <Link href="/home" aria-label="Home" className="-ml-1 inline-flex shrink-0">
            <Logo size={92} className="sm:!w-[108px]" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--color-brand-muted)] sm:inline">
              {user?.name ?? 'Farmer'}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-[var(--color-brand-muted)] transition-colors hover:bg-[var(--color-brand-accent)]/40 hover:text-[var(--color-brand-fg)]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className="mx-auto px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* Greeting */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            Welcome back
          </p>
          <h1
            className="mt-1 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-h1)' }}
          >
            {farm ? farm.name : 'Loading your farm…'}
          </h1>
          {farm && (
            <p className="mt-1 text-sm text-[var(--color-brand-muted)]">
              {[farm.state, farm.address].filter(Boolean).join(' · ') || 'No location set'}
            </p>
          )}
        </div>

        {/* Stat row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Warehouse}
            label="Pens"
            value={pens.data?.pens.length ?? 0}
            sub={`${freeCount(pens.data?.pens)} free`}
          />
          <StatCard
            icon={Bird}
            label="Active flocks"
            value={flocks.data?.flocks.length ?? 0}
            sub={`${totalBirds(flocks.data?.flocks).toLocaleString()} birds`}
          />
          <StatCard
            icon={Sparkles}
            label="Tier"
            value={farm?.farmStat?.activeFlocksCount ?? 0}
            sub="cycles tracked"
          />
        </div>

        {/* Quick add */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" size="lg" className="h-14 justify-start px-5">
            <Link href="/setup/pens">
              <Plus className="h-5 w-5" />
              Add a pen
            </Link>
          </Button>
          <Button asChild size="lg" className="h-14 justify-start px-5">
            <Link href="/setup/flocks">
              <Plus className="h-5 w-5" />
              Place a new flock
            </Link>
          </Button>
        </div>

        {/* Coming-soon notice */}
        <div className="mt-10 rounded-3xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-6 text-center">
          <p className="text-sm font-semibold text-[var(--color-brand-fg)]">
            Daily logs, vaccine reminders, FCR & cost analytics coming next.
          </p>
          <p className="mt-1 text-xs text-[var(--color-brand-muted)]">
            Your setup is live — we&rsquo;re building the daily-tracking surface next.
          </p>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-[var(--color-brand-border)] bg-white p-5 transition-all hover:border-[var(--color-brand-primary)]/40">
      <div className="flex items-start justify-between">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-muted)]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--color-brand-fg)]">
        {value}
      </p>
      <p className="text-xs text-[var(--color-brand-muted)]">{sub}</p>
    </div>
  );
}

function freeCount(pens?: PenDto[]): number {
  if (!pens) return 0;
  return pens.filter((p) => p.occupancy?.status !== 'occupied').length;
}

function totalBirds(flocks?: FlockDto[]): number {
  if (!flocks) return 0;
  return flocks.reduce((sum, f) => sum + (f.currentBirds ?? f.placedBirds ?? 0), 0);
}
