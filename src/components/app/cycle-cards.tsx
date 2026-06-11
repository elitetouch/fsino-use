'use client';

import { useState } from 'react';
import {
  Bird, Droplet, Skull, Syringe, Wheat, ChevronRight, Egg,
  Check, X as XIcon, Info, ChevronDown,
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
          // The backend can't compute FCR without BOTH (a) feed
          // logged in kg AND (b) at least one bird-weight record
          // (broilers) or eggs in good condition + an egg weight
          // (layers). If the user has been logging feed in `bags`
          // only, lifetime_feed_kg is 0 and FCR returns null; the
          // copy below tells them what to add next.
          ? 'Log feed in kilograms and a bird weight to see your conversion rate.'
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

  // Chronological list (oldest → newest) so the user reads the schedule
  // top-down the way a calendar reads. The "Show all" toggle controls
  // whether we cap to 5 visible rows (matching the figma's preview
  // count) or expand to the full schedule.
  const [showAll, setShowAll] = useState(false);
  const ordered = chronologicalOrder(items);
  const VISIBLE_DEFAULT = 5;
  const visibleItems = showAll ? ordered : ordered.slice(0, VISIBLE_DEFAULT);

  // Counter-pill tone — matches the figma's intent:
  //   amber pill when something is overdue or due today (needs the user's
  //   attention), green when the schedule is on track. The figma's "11/20"
  //   was amber because OCT 8 Fowlpox was missed — the pill colour is
  //   the first signal that something needs a tap.
  const needsAttention = criticalOverdue > 0 || overdue > 0 || dueToday > 0;
  const counterTone = needsAttention
    ? 'bg-amber-100 text-amber-800'
    : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';

  return (
    <Card>
      <CardHeader
        icon={Syringe}
        title="Vaccination record"
        rightSlot={
          total > 0 ? (
            <span className={cn(
              'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums',
              counterTone,
            )}>
              {completed} / {total}
            </span>
          ) : undefined
        }
      />

      {/* Figma is deliberately quiet — no critical / overdue / next-up
          banners. The per-row indicators (red ✗ for missed, green ✓ for
          done, TODAY for today, em-dash for upcoming) ARE the surface
          the user reads. Anything more competes with the schedule for
          attention. */}

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

      {/* Figma footer: blue "Learn more about this" badge on the left,
          "Show all ⌄" on the right. Only render the toggle when the
          schedule is long enough to need collapsing (or already
          expanded so the user can collapse it back). */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-brand-border)] pt-3">
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11.5px] font-semibold text-sky-700 hover:bg-sky-100"
        >
          <Info className="h-3 w-3" strokeWidth={2.5} />
          Learn more about this
        </button>
        {ordered.length > VISIBLE_DEFAULT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
          >
            {showAll ? 'Show less' : 'Show all'}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                showAll && 'rotate-180',
              )}
            />
          </button>
        )}
      </div>
    </Card>
  );
}

/**
 * Single row in the vaccination list. Mirrors the figma mobile layout:
 *
 *   [SEP 1]   Fowlpox                       [TODAY pill]
 *   [SEP 3]   Newcastle disease                       —
 *   [SEP 8]   Marek's disease                         —
 *   [AUG 22]  Gumboro                          [✓ green dot]
 *
 * Left column is the SCHEDULED DATE in compact "MMM D" form (e.g.
 * "SEP 1"). The figma uses the calendar date as the farmer's primary
 * anchor — vaccines line up with a wall calendar, not with a
 * "day-of-cycle" tally. The previous "D5" pill was an internal
 * concept that didn't survive contact with how farmers actually plan.
 *
 * Right column is a single visual status indicator (per the user's
 * direct ask: "vaccines that have been given should be CHECKED GOOD
 * just like in the figma"):
 *
 *   completed → solid green circle with a white check, nothing else.
 *   today     → green "TODAY" pill in caps.
 *   upcoming  → em-dash in muted grey.
 *   overdue   → red badge ("OVERDUE Nd" or "OVERDUE" for crit class).
 *   skipped   → grey "skipped" tag.
 *
 * Critical items still render their name in bold and keep their tiny
 * red "Critical" pill — losing that on an overdue Newcastle row would
 * wipe out an entire pen.
 */
function VaccinationRow({ item }: { item: VaccinationItemDto }) {
  const isToday = item.status === 'today';
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-2 py-3 -mx-2 transition-colors',
        // Today row gets a soft cream/beige row background per the
        // figma — visually anchors the user's eye on "this is what
        // needs to happen now" without resorting to a coloured pill.
        isToday && 'rounded-md bg-amber-50/60',
      )}
    >
      {/*
        Left date column — fixed-width so all rows line up vertically
        regardless of label length. "OCT 2" is 5 chars, "OCT 14" is 6;
        the column is sized for the longer one.
      */}
      <span className="inline-flex w-[3.4rem] shrink-0 items-center text-[10.5px] font-bold uppercase leading-tight tracking-[0.08em] text-[var(--color-brand-muted)]">
        {formatScheduledDate(item.scheduledDateLabel)}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13.5px] leading-snug text-[var(--color-brand-fg)]',
            // Bold the vaccine name on today's row (per figma); keep
            // normal weight otherwise so the row reads cleanly.
            isToday ? 'font-extrabold' : 'font-semibold',
          )}
        >
          {item.name}
        </p>
      </div>

      <VaccinationStatusIndicator item={item} />
    </li>
  );
}

/**
 * Right-aligned status indicator — one of: green check disc / TODAY pill
 * / em-dash / overdue badge / skipped tag.
 *
 * Kept as its own component so the row body stays clean and the
 * indicator's variants are easy to scan.
 */
function VaccinationStatusIndicator({ item }: { item: VaccinationItemDto }) {
  if (item.status === 'completed') {
    // Plain green check icon — no disc background. Matches the
    // figma's clean "OCT 2 Newcastle Disease ✓" treatment.
    return (
      <Check
        aria-label="Vaccinated"
        className="h-5 w-5 shrink-0 text-[var(--color-brand-primary)]"
        strokeWidth={3}
      />
    );
  }

  if (item.status === 'today') {
    // Plain uppercase "TODAY" text — no pill background. The row
    // itself is already tinted beige (see VaccinationRow), so the
    // indicator stays muted/textual.
    return (
      <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-fg)]">
        Today
      </span>
    );
  }

  if (item.status === 'overdue') {
    // Plain red X — matches the figma's "OCT 8 Fowlpox ✗" missed-dose
    // treatment. No pill, no "OVERDUE Xd" text — the red ✗ alone
    // communicates "you missed this one". Wrapped in a <span> so we
    // can attach `title` for the hover hint (lucide-react icons don't
    // accept the title prop directly).
    return (
      <span
        title={item.critical ? 'Missed — critical vaccine' : 'Missed'}
        className="shrink-0"
      >
        <XIcon
          aria-label={`Missed${item.critical ? ' — critical' : ''}`}
          className={cn(
            'h-5 w-5',
            item.critical ? 'text-rose-600' : 'text-rose-500',
          )}
          strokeWidth={3}
        />
      </span>
    );
  }

  if (item.status === 'skipped') {
    return (
      <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">
        Skipped
      </span>
    );
  }

  // Upcoming — short em-dash bar (figma uses a thick grey rule, not a
  // typographic dash, so we draw a fixed-width bar instead of using
  // U+2014 which can shift baseline-render on iOS Safari).
  return (
    <span
      aria-label="Upcoming"
      title="Upcoming"
      className="inline-block h-[3px] w-4 shrink-0 rounded-full bg-[var(--color-brand-border)]"
    />
  );
}

/**
 * "Sep 1" → "SEP 1" (uppercase) to match the figma's all-caps
 * date column. Falls back gracefully if the backend ever ships a
 * different format.
 */
function formatScheduledDate(label: string | null | undefined): string {
  if (!label) return '';
  return label.toUpperCase();
}

/**
 * Calendar order: oldest scheduled date first, newest last. Matches the
 * figma's "OCT 2 → OCT 8 → OCT 14 (today) → OCT 16 → OCT 21" reading
 * order — the user scans the card top-down like a wall calendar. The
 * previous bucket-based ordering (overdue → today → upcoming →
 * completed) re-implemented the warning hierarchy that the figma
 * deliberately drops in favour of per-row icons.
 */
function chronologicalOrder(items: VaccinationItemDto[]): VaccinationItemDto[] {
  return [...items].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
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
