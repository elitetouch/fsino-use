'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bird, Warehouse, Wallet, TrendingUp, Plus, ClipboardList,
  ArrowRight, Sparkles, CheckCircle2, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { CyclePicker } from '@/components/app/cycle-picker';
import { CycleCardsGrid } from '@/components/app/cycle-cards-grid';
import { endpoints, type FarmDto, type FlockDto, type PenDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { readUser } from '@/lib/auth';
import { readCurrentFarmId, useCurrentFarmId, writeCurrentFarmId } from '@/lib/farm-context';
import { readLastCycle, writeLastCycle } from '@/lib/last-cycle';

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

  // Hydration-safe read of the per-staff, per-farm last-visited cycle.
  // Starts null on the server, syncs once on mount when localStorage
  // is available. The (userId, farmId) tuple is the cache key so two
  // staff on the same farm — or the same staff on two farms — never
  // share memory.
  const [lastCycleId, setLastCycleId] = useState<string | null>(null);
  useEffect(() => {
    if (!currentFarmId || !user?.id) return;
    setLastCycleId(readLastCycle(currentFarmId, user.id));
  }, [currentFarmId, user?.id]);

  // Pick the current cycle. Order of preference:
  //   1. Last-visited (validated against the active flocks list — an
  //      archived/deleted id silently falls through so we never pin
  //      the dashboard to a cycle the server will refuse to load).
  //   2. Most-recently-placed flock — the sensible default for a
  //      first-visit user or anyone whose last cycle was archived.
  const cycle = useMemo<FlockDto | undefined>(() => {
    const items = flocks.data?.flocks ?? [];
    if (items.length === 0) return undefined;
    if (lastCycleId) {
      const remembered = items.find((f) => f.id === lastCycleId);
      if (remembered) return remembered;
    }
    return items.slice().sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];
  }, [flocks.data, lastCycleId]);

  // If the remembered id no longer points at an active flock, purge
  // it so subsequent loads stop trying. (Also covers the case where
  // the user archived their last cycle from another device.)
  useEffect(() => {
    if (!currentFarmId || !user?.id || !lastCycleId) return;
    const items = flocks.data?.flocks ?? [];
    if (items.length > 0 && !items.some((f) => f.id === lastCycleId)) {
      writeLastCycle(currentFarmId, user.id, null);
      setLastCycleId(null);
    }
  }, [flocks.data, lastCycleId, currentFarmId, user?.id]);

  // Mirror the home-page selection into the last-cycle memory. This
  // covers the case where the user uses the CyclePicker on the home
  // page itself — the picker pushes to /cycles/[id] which records the
  // visit, but we also want the *default* the home page resolved on
  // first paint to be sticky if the user lingers and reloads.
  useEffect(() => {
    if (!currentFarmId || !user?.id || !cycle?.id) return;
    writeLastCycle(currentFarmId, user.id, cycle.id);
  }, [currentFarmId, user?.id, cycle?.id]);

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

      {/* Today's record CTA — front-and-centre so consistent daily logging
          is one tap away. Only renders when there's an active cycle to
          log against. Adapts to "Edit" copy when today already has at
          least one record. */}
      {cycle && (
        <Gate perm="flocks.records.create">
          <TodayRecordCTA cycle={cycle} />
        </Gate>
      )}

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

          <CycleCardsGrid cycle={cycle} penId={cycle.penId ?? undefined} />

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
          {/* "Log" needs an active cycle to land on — without one, the
              empty-state CTA above already invites them to place a flock,
              so we just hide this row's button. */}
          {cycle && (
            <Gate perm="flocks.records.create">
              <Button asChild size="sm" variant="outline">
                <Link href={`/cycles/${cycle.id}/record`}>
                  <ClipboardList className="h-3.5 w-3.5" />
                  Log
                </Link>
              </Button>
            </Gate>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Today's-record hero card — the dashboard's most-clicked button.
 *
 * Goal: zero friction for the daily logging habit. The card is the
 * first thing under the greeting; the right-side button is full-width
 * on mobile; status copy reflects whether anything's been logged today
 * so the user instantly knows whether they're adding or topping-up.
 *
 * Data: reads the per-month calendar query for the active cycle and
 * checks whether today's date has any records. Defensive `.slice(0,10)`
 * on the response date in case any legacy/cached calendar payload
 * carries a time component.
 */
function TodayRecordCTA({ cycle }: { cycle: FlockDto }) {
  const today = todayYmd();
  const month = today.slice(0, 7);
  const calendar = useQuery({
    queryKey: ['daily-record-calendar', cycle.id, month],
    queryFn: () => endpoints.getDailyRecordCalendar(cycle.id, month),
    staleTime: 30_000,
    enabled: !!cycle.id,
  });

  const todayEntry = calendar.data?.days.find(
    (d) => d.date.slice(0, 10) === today,
  );
  const todayRecordCount = todayEntry?.recordCount ?? 0;
  const todayHasRecord = todayRecordCount > 0;

  return (
    <section
      className={
        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 ' +
        (todayHasRecord
          ? 'border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-accent)]/40'
          : 'border-[var(--color-brand-primary)] bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-white shadow-[0_10px_30px_-15px_rgba(15,80,30,0.40)]')
      }
    >
      <span
        className={
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' +
          (todayHasRecord
            ? 'bg-[var(--color-brand-primary)] text-white'
            : 'bg-white/20 text-white')
        }
      >
        {todayHasRecord
          ? <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.4} />
          : <ClipboardList className="h-4.5 w-4.5" strokeWidth={2.4} />}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={
            'text-[10.5px] font-bold uppercase tracking-[0.16em] ' +
            (todayHasRecord ? 'text-[var(--color-brand-primary-deep)]' : 'text-white/80')
          }
        >
          Today&rsquo;s record
        </p>
        <p
          className={
            'mt-0.5 text-[14px] font-bold tracking-tight ' +
            (todayHasRecord ? 'text-[var(--color-brand-fg)]' : 'text-white')
          }
        >
          {todayFullLabel()}
          {' · '}
          <span className={todayHasRecord ? 'text-[var(--color-brand-primary-deep)]' : 'text-white/90'}>
            {todayHasRecord
              ? `${todayRecordCount} ${todayRecordCount === 1 ? 'entry' : 'entries'} logged`
              : 'Not yet logged'}
          </span>
        </p>
        <p
          className={
            'mt-0.5 text-[11.5px] leading-snug ' +
            (todayHasRecord ? 'text-[var(--color-brand-muted)]' : 'text-white/80')
          }
        >
          {todayHasRecord
            ? 'Open today’s entry to update feed, water, vaccinations or weight.'
            : 'A daily log keeps FCR, mortality and margin trends accurate.'}
        </p>
      </div>

      <div className="sm:shrink-0">
        <Button
          asChild
          size="sm"
          className={
            'h-10 w-full sm:w-auto ' +
            (todayHasRecord
              ? ''
              : 'bg-white text-[var(--color-brand-primary-deep)] hover:bg-white/95')
          }
          variant={todayHasRecord ? 'outline' : undefined}
        >
          <Link href={`/cycles/${cycle.id}/record`}>
            {todayHasRecord
              ? <><Pencil className="h-3.5 w-3.5" /> Edit today&rsquo;s record</>
              : <><Plus className="h-3.5 w-3.5" /> Add today&rsquo;s record</>}
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Today as YYYY-MM-DD in the user's local timezone. */
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Long-form today label, e.g. "Wed, Jun 4". */
function todayFullLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
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
      <Gate perm="flocks.create">
        <Button asChild size="sm" className="mt-4">
          <Link href="/setup/flocks">
            <Plus className="h-3.5 w-3.5" />
            Place a flock
          </Link>
        </Button>
      </Gate>
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
