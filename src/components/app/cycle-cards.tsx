'use client';

import {
  Bird, Droplet, Skull, Syringe, Wheat, ChevronRight, Egg,
  ShieldAlert, AlertTriangle, Calendar, Check,
  type LucideIcon,
} from 'lucide-react';
import type {
  FeedCardDto, FlockDto, MortalityCardDto,
  EggCollectionCardDto, VaccinationCardDto, VaccinationItemDto, WaterCardDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Cards shown on the cycle-results dashboard. Each one consumes a
 * card DTO precomputed by PenDashboardService (one round trip serves
 * every card on the page). Cards render their own empty state when
 * the user hasn't logged any records yet — the layout stays complete
 * and the user always knows what's next.
 *
 * Source of truth for shapes: see lib/api.ts (PenDashboardCards).
 */

// ────────────── BREED SUMMARY CARD ──────────────

export function BreedSummaryCard({ flock }: { flock: FlockDto }) {
  const days = flock.ageDays ?? 0;
  return (
    <Card className="lg:col-span-2">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Bird className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-bold text-[var(--color-brand-fg)]">{flock.breed}</p>
            <span className="shrink-0 rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {flock.placedBirds.toLocaleString()} birds
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
            {labelForProduction(flock.productionType)}.{' '}
            <strong className="text-[var(--color-brand-fg)]">{days} days old</strong>.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ────────────── FEED CONSUMPTION ──────────────

export function FeedConsumptionCard({
  data,
  onEdit,
}: {
  data?: FeedCardDto | null;
  onEdit?: () => void;
}) {
  const fcr = data?.summary.fcr ?? null;
  const rating = data?.summary.ratingLabel ?? null;
  const empty = fcr == null;

  // Visual FCR meter — broiler good FCR is roughly 1.4–1.8.
  // We translate any FCR into a 0–1 progress on the bar.
  const pct = fcr == null ? null : Math.max(0, Math.min(1, (fcr - 1.2) / 1.4)) * 100;

  return (
    <Card>
      <CardHeader
        icon={Wheat}
        title="Feed consumption"
        rightSlot={
          rating ? (
            <span className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-bold capitalize text-white',
              feedRatingTone(rating),
            )}>
              {rating}
            </span>
          ) : undefined
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'Log feed records to compute your conversion rate.'
          : firstInsight(data) ?? 'Your birds show a stable feed conversion rate.'}
      </p>

      <div className="mt-4">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
          Feed conversion rate (FCR)
        </p>
        <div className="relative h-7">
          <div className="absolute inset-y-0 left-0 right-0 my-auto h-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-300 via-amber-200 to-rose-200">
            <div className="absolute inset-0 opacity-0" />
          </div>
          {fcr != null && pct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-md bg-[var(--color-brand-primary)] px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
              style={{ left: `${pct}%` }}
            >
              {fcr.toFixed(2)}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-[var(--color-brand-muted-soft)]">
          <span>Lower is better</span>
          <span>Higher is worse</span>
        </div>
      </div>

      <CardFooter onClick={onEdit} label={empty ? 'Log feed' : 'Edit record'} />
    </Card>
  );
}

function feedRatingTone(rating: string): string {
  const r = rating.toLowerCase();
  if (r.includes('excell') || r.includes('good')) return 'bg-[var(--color-brand-primary-dark)]';
  if (r.includes('fair') || r.includes('avg')) return 'bg-amber-600';
  return 'bg-rose-600';
}

// ────────────── WATER CONSUMPTION ──────────────

export function WaterConsumptionCard({
  data,
  onEdit,
}: {
  data?: WaterCardDto | null;
  onEdit?: () => void;
}) {
  const avg = data?.summary.avgMlPerBirdPerDay ?? null;
  const items = recentDailyPoints(data?.series, 5);
  const empty = avg == null;

  return (
    <Card>
      <CardHeader
        icon={Droplet}
        title="Water consumption"
        rightSlot={
          avg != null ? (
            <span className="rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {Math.round(avg)} ml/bird/day
            </span>
          ) : undefined
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'No water consumption recorded yet.'
          : firstInsight(data) ?? 'Average daily water per bird across recent days.'}
      </p>

      {items.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
            Daily water amount
          </p>
          <DailyBars items={items} unit="L" tone="sky" />
        </div>
      )}

      <CardFooter onClick={onEdit} label={empty ? 'Log water' : 'Edit record'} />
    </Card>
  );
}

// ────────────── MORTALITY ──────────────

export function MortalityCard({
  data,
  onEdit,
}: {
  data?: MortalityCardDto | null;
  onEdit?: () => void;
}) {
  const rate = data?.summary.rate ?? null;
  const rateLabel = data?.summary.rateLabel ?? null;
  const items = recentDailyPoints(data?.series, 5);
  const empty = rate == null && items.length === 0;
  const cause = data?.summary.primaryCause ?? null;

  // Healthy: green; watch: amber; concerning: red.
  const labelTone = !rateLabel ? null
    : rateLabel.toLowerCase().includes('healthy') ? 'bg-[var(--color-brand-primary-dark)]'
    : rateLabel.toLowerCase().includes('watch') ? 'bg-amber-600'
    : 'bg-rose-600';

  return (
    <Card>
      <CardHeader
        icon={Skull}
        title="Mortality rate"
        rightSlot={
          rate != null ? (
            <span className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-bold text-white',
              labelTone ?? 'bg-[var(--color-brand-primary-dark)]',
            )}>
              {rate.toFixed(1)}%
            </span>
          ) : undefined
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'No mortality logged yet.'
          : firstInsight(data) ?? 'Birds dead or culled across recent days.'}
      </p>

      {cause && (
        <p className="mt-2 text-[11.5px] text-[var(--color-brand-fg-soft)]">
          Primary cause:{' '}
          <strong className="text-[var(--color-brand-fg)]">{cause}</strong>
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
            Birds dead or culled
          </p>
          <DailyBars items={items} unit="" tone="rose" />
        </div>
      )}

      <CardFooter onClick={onEdit} label={empty ? 'Log mortality' : 'Edit record'} />
    </Card>
  );
}

// ────────────── EGG COLLECTION ──────────────

export function EggCollectionCard({
  data,
  onEdit,
}: {
  data?: EggCollectionCardDto | null;
  onEdit?: () => void;
}) {
  const avgPerDay = data?.summary.avgPerDay ?? null;
  const lifetimeGood = data?.summary.lifetimeGoodEggs ?? 0;
  const lifetimeDamaged = data?.summary.lifetimeDamagedEggs ?? 0;
  const items = recentDailyPoints(data?.series, 5);
  const layRate = data?.summary.layRatePct ?? null;
  const empty = lifetimeGood === 0 && items.length === 0;

  return (
    <Card>
      <CardHeader
        icon={Egg}
        title="Egg collection"
        rightSlot={
          !empty ? (
            <span className="rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {avgPerDay != null ? `${avgPerDay}/day` : `${lifetimeGood} total`}
            </span>
          ) : undefined
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'No eggs collected yet.'
          : layRate != null
            ? `Current lay rate is ${layRate.toFixed(1)}%.`
            : 'Eggs collected across recent days.'}
      </p>

      {(lifetimeDamaged > 0) && (
        <p className="mt-2 text-[11.5px] text-[var(--color-brand-fg-soft)]">
          Lifetime:{' '}
          <strong className="text-[var(--color-brand-fg)]">{lifetimeGood.toLocaleString()} good</strong>
          {' · '}
          <span className="text-rose-700">{lifetimeDamaged.toLocaleString()} damaged</span>
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
            Eggs per day
          </p>
          <DailyBars items={items} unit="" tone="mint" />
        </div>
      )}

      <CardFooter onClick={onEdit} label={empty ? 'Log eggs' : 'Edit record'} />
    </Card>
  );
}

// ────────────── VACCINATION (high-priority accuracy) ──────────────

/**
 * Vaccination record card — the safety surface for the flock.
 *
 * Display priority (top → bottom):
 *   1. Critical overdue strip (Newcastle / Gumboro / Marek's class
 *      overdue) — bright red, FIRST, because a missed dose at the
 *      wrong age can wipe out the pen. The backend flags these via
 *      `critical: true` + `status: 'overdue'`.
 *   2. Next-actionable banner — the single item the user should
 *      handle next, chosen by the backend (overdue critical →
 *      overdue any → due today → next upcoming).
 *   3. List of items with status pills, ordered:
 *        overdue critical → overdue → today → upcoming → completed
 *      Completed items are de-emphasized and capped at 3 most recent
 *      to keep the card scannable.
 *   4. Insights / footer.
 *
 * All numbers come straight from VaccinationCard::build() server-side
 * (fuzzy-matched against records by name + window), so the front end
 * is purely presentational.
 */
export function VaccinationCard({
  data,
  onManage,
}: {
  data?: VaccinationCardDto | null;
  onManage?: () => void;
}) {
  const summary = data?.summary;
  const items = data?.items ?? [];
  const empty = items.length === 0;
  const completed = summary?.completed ?? 0;
  const total = summary?.totalScheduled ?? 0;
  const criticalOverdue = summary?.criticalOverdue ?? 0;
  const overdue = summary?.overdue ?? 0;
  const dueToday = summary?.dueToday ?? 0;
  const nextDue = summary?.nextDue ?? null;

  // Three-bucket grouping for the list — completed gets capped so it
  // doesn't drown out actionable items. We always show every overdue
  // and today entry; upcoming is capped to keep the card compact.
  const sortedItems = orderVaccinationItems(items);
  const visibleItems = capCompleted(sortedItems, 3, 4);

  return (
    <Card>
      <CardHeader
        icon={Syringe}
        title="Vaccination record"
        rightSlot={
          total > 0 ? (
            <span className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-bold text-white',
              criticalOverdue > 0
                ? 'bg-rose-600'
                : overdue > 0
                  ? 'bg-amber-600'
                  : 'bg-[var(--color-brand-primary-dark)]',
            )}>
              {completed}/{total}
            </span>
          ) : undefined
        }
      />

      {/* Critical strip — overrides any other surface */}
      {criticalOverdue > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-rose-700">
              Critical · overdue
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-rose-800">
              {criticalOverdue} life-essential vaccination{criticalOverdue === 1 ? '' : 's'}{' '}
              overdue (Newcastle / Gumboro / Marek class). Administer immediately to prevent
              flock loss.
            </p>
          </div>
        </div>
      )}

      {/* Non-critical overdue / today strip */}
      {criticalOverdue === 0 && (overdue > 0 || dueToday > 0) && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[12px] leading-snug text-amber-900">
            {overdue > 0 && `${overdue} overdue`}{overdue > 0 && dueToday > 0 && ' · '}
            {dueToday > 0 && `${dueToday} due today`}.
            Schedule them as soon as possible.
          </p>
        </div>
      )}

      {/* Next-actionable banner — only shown when nothing critical is screaming */}
      {criticalOverdue === 0 && overdue === 0 && dueToday === 0 && nextDue && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-[var(--color-brand-accent)]/40 px-3 py-2.5">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-primary-deep)]" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[var(--color-brand-fg)]">
              Next up: {nextDue.name}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-fg-soft)]">
              {whenLabel(nextDue)} · {nextDue.scheduledDateLabel}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {empty && (
        <p className="mt-3 text-[12px] text-[var(--color-brand-muted)]">
          {summary == null
            ? 'No vaccination schedule found. Set the flock\'s breed to auto-build one.'
            : 'No vaccinations in your schedule yet.'}
        </p>
      )}

      {/* List */}
      {visibleItems.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--color-brand-border)]">
          {visibleItems.map((row) => (
            <VaccinationRow key={row.id} item={row} />
          ))}
        </ul>
      )}

      <CardFooter onClick={onManage} label={total === 0 ? 'View schedule' : 'Manage schedule'} />
    </Card>
  );
}

/**
 * Single row in the vaccination list.
 *
 * Layout:
 *   [age-pill] [name + scheduled date]   [status badge]
 *
 * The age-pill (e.g. "D5") matches the figma — vaccines are scheduled
 * at known days from placement, and the day number is the farmer's
 * primary mental anchor. Critical items render their name in bold so
 * they stay legible even in the noise of a busy schedule.
 */
function VaccinationRow({ item }: { item: VaccinationItemDto }) {
  const pillTone = pillToneForItem(item);
  const isOverdueCritical = item.status === 'overdue' && item.critical;
  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <span className={cn(
        'inline-flex h-7 min-w-[2.4rem] shrink-0 items-center justify-center rounded-md px-1 text-[10.5px] font-bold tracking-tight',
        pillTone,
      )}>
        D{item.ageDays}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-[13px] leading-snug text-[var(--color-brand-fg)]',
          isOverdueCritical ? 'font-bold' : 'font-medium',
        )}>
          {item.name}
          {item.critical && (
            <span className="ml-1.5 inline-flex items-center rounded-sm bg-rose-100 px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-rose-700">
              Critical
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--color-brand-muted)]">
          {item.scheduledDateLabel}
          {item.diseaseTarget ? ` · ${item.diseaseTarget}` : ''}
          {item.method ? ` · ${item.method}` : ''}
        </p>
      </div>
      <span className={cn(
        'mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider',
        statusTone(item.status),
      )}>
        {item.status === 'completed' && <Check className="h-3 w-3" />}
        {statusLabel(item)}
      </span>
    </li>
  );
}

function pillToneForItem(item: VaccinationItemDto): string {
  if (item.status === 'overdue' && item.critical) return 'bg-rose-600 text-white';
  if (item.status === 'overdue') return 'bg-amber-100 text-amber-700';
  if (item.status === 'today') return 'bg-amber-100 text-amber-700';
  if (item.status === 'completed') return 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';
  if (item.status === 'skipped') return 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted-soft)]';
  return 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]';
}

function statusTone(status: VaccinationItemDto['status']): string {
  switch (status) {
    case 'overdue':   return 'text-rose-700';
    case 'today':     return 'text-amber-700';
    case 'completed': return 'text-[var(--color-brand-primary-deep)]';
    case 'skipped':   return 'text-[var(--color-brand-muted-soft)]';
    default:          return 'text-[var(--color-brand-muted-soft)]';
  }
}

function statusLabel(item: VaccinationItemDto): string {
  switch (item.status) {
    case 'overdue':
      return `Overdue ${Math.abs(item.daysFromToday)}d`;
    case 'today':     return 'Today';
    case 'completed': return 'Done';
    case 'skipped':   return 'Skipped';
    default: {
      const d = item.daysFromToday;
      if (d <= 0) return 'Upcoming';
      if (d === 1) return 'Tomorrow';
      return `In ${d}d`;
    }
  }
}

function whenLabel(item: VaccinationItemDto): string {
  const d = item.daysFromToday;
  if (d === 0) return 'Due today';
  if (d > 0) return d === 1 ? 'Due tomorrow' : `Due in ${d} days`;
  return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago — still inside grace window`;
}

/**
 * Order rule: overdue (critical first) → today → upcoming → completed →
 * skipped. Within each bucket, completed is reverse-chronological (most
 * recent first) and the rest are chronological (next-due first).
 */
function orderVaccinationItems(items: VaccinationItemDto[]): VaccinationItemDto[] {
  const bucket = (i: VaccinationItemDto): number => {
    if (i.status === 'overdue' && i.critical) return 0;
    if (i.status === 'overdue') return 1;
    if (i.status === 'today') return 2;
    if (i.status === 'upcoming') return 3;
    if (i.status === 'completed') return 4;
    return 5; // skipped
  };
  return [...items].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    if (a.status === 'completed') return b.scheduledDate.localeCompare(a.scheduledDate);
    return a.scheduledDate.localeCompare(b.scheduledDate);
  });
}

/**
 * Cap the completed tail at `maxCompleted` and the upcoming tail at
 * `maxUpcoming`. Overdue + today are NEVER capped — they're the whole
 * point of the card.
 */
function capCompleted(
  items: VaccinationItemDto[],
  maxCompleted: number,
  maxUpcoming: number,
): VaccinationItemDto[] {
  const out: VaccinationItemDto[] = [];
  let completedShown = 0;
  let upcomingShown = 0;
  for (const i of items) {
    if (i.status === 'completed') {
      if (completedShown >= maxCompleted) continue;
      completedShown++;
    } else if (i.status === 'upcoming') {
      if (upcomingShown >= maxUpcoming) continue;
      upcomingShown++;
    }
    out.push(i);
  }
  return out;
}

// ────────────── PRIMITIVES ──────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        'rounded-xl border border-[var(--color-brand-border)] bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,80,30,0.10)]',
        className,
      )}
    >
      {children}
    </article>
  );
}

function CardHeader({
  icon: Icon,
  title,
  rightSlot,
}: {
  icon: LucideIcon;
  title: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
      </div>
      {rightSlot}
    </div>
  );
}

function CardFooter({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-[var(--color-brand-border)] pt-2.5">
      <button
        type="button"
        className="text-[12px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
      >
        Learn more
      </button>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
      >
        {label}
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function DailyBars({
  items,
  unit,
  tone,
}: {
  items: Array<{ date: string; value: number | null }>;
  unit: string;
  tone: 'sky' | 'rose' | 'mint';
}) {
  const max = Math.max(...items.map((x) => x.value ?? 0), 1);
  const barClass = {
    sky:  'from-sky-400 to-sky-600',
    rose: 'from-rose-400 to-rose-600',
    mint: 'from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)]',
  }[tone];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((d) => {
        const v = d.value ?? 0;
        const h = v > 0 ? Math.max(8, Math.round((v / max) * 64)) : 4;
        return (
          <div key={d.date} className="flex flex-col items-center">
            <div className="relative flex h-16 w-full items-end justify-center">
              <div
                className={cn(
                  'w-full rounded bg-gradient-to-b',
                  v > 0 ? barClass : 'from-[var(--color-brand-input-border)] to-[var(--color-brand-input-border)]',
                )}
                style={{ height: `${h}px` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-semibold text-[var(--color-brand-fg)]">
              {d.value == null ? '—' : `${fmtCompact(v)}${unit}`}
            </p>
            <p className="text-[9px] text-[var(--color-brand-muted-soft)]">{shortDate(d.date)}</p>
          </div>
        );
      })}
    </div>
  );
}

// ────────────── HELPERS ──────────────

function labelForProduction(t: FlockDto['productionType']): string {
  return t === 'broiler' ? 'Broilers for meat production' : t === 'layer' ? 'Layers for egg production' : 'Dual-purpose';
}

/** Pull the last `n` daily points from any series shape, in chronological order. */
function recentDailyPoints(
  series:
    | { mode: 'easy' | 'daily'; daily?: Array<{ date: string; value: number | null }> }
    | { mode: 'expert'; morning?: Array<{ date: string; value: number | null }>; evening?: Array<{ date: string; value: number | null }> }
    | undefined,
  n: number,
): Array<{ date: string; value: number | null }> {
  if (!series) return [];
  if (series.mode === 'expert') {
    // Combine morning + evening by date.
    const byDate = new Map<string, number>();
    for (const p of series.morning ?? []) {
      if (p.value != null) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
    }
    for (const p of series.evening ?? []) {
      if (p.value != null) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
    }
    const merged = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
    return merged.slice(-n);
  }
  const daily = series.daily ?? [];
  return daily.slice(-n);
}

function firstInsight(card?: { insights?: string[] } | null): string | undefined {
  return card?.insights?.[0];
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}
