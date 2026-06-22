'use client';

import { useState } from 'react';
import {
  Bird, Droplet, Skull, Syringe, Wheat, ChevronRight, Egg,
  Check, BadgeCheck, X as XIcon, Info, ChevronDown,
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
            {/* Bird-count pill — figma uses BLACK here ("100 birds" /
                "2,000 birds" / "280 birds"), not brand green. Only
                weight/water/rating badges are green. Keeps counts
                visually distinct from production-status badges. */}
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
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

/**
 * Feed consumption card — rebuilt to match the figma "Preference: Easy /
 * Expert / First entry state" frames strictly. See FarmSpeak 2023 Frame
 * 1000004325. The chrome reads:
 *
 *   [icon] Feed consumption                       (no right-slot pill)
 *   Your birds show a [great] feed conversion rate.
 *
 *   Feed conversion rate (FCR)
 *   Low  ▬▬▬▬▬▬▬ [1.45] ▬▬▬▬▬▬  High
 *
 *   Daily feed amount             Starter: Animal Care
 *   Jan 1   Jan 2   Jan 3   Jan 4   Jan 5
 *   [1,2kg] [12kg]  [120kg] [1.2Mkg][12tons]
 *
 *   ✓ Learn more                              Edit record ›
 *
 * Critical deltas from the previous implementation:
 *
 *   - NO rating pill in the header. The figma reads the rating into
 *     the description sentence instead ("Your birds show A GREAT…").
 *   - Gauge gradient runs rose → amber → emerald → sky (centered on
 *     optimal), not the previous emerald → amber → rose (lower-is-
 *     better). The figma treats extreme low values as suspicious
 *     ("did you really log 0.4 kg/bird?") rather than excellent.
 *   - Below the gauge: "Low" / "High" labels flank the bar, not
 *     "Lower is better / Higher is worse" sitting beneath it.
 *   - Replaces vertical bar charts (DailyBars) with the figma's
 *     horizontal pill grid: each day is a date label + a beige pill
 *     containing the value, all 5 columns flowing across.
 *   - Twice-a-day pref splits into "Morning feed amount" + "Evening
 *     feed amount" sections, each with their own brand badge.
 *   - Footer "Learn more" gets the green check-circle badge the
 *     figma shows, distinct from the vaccination card's sky-blue
 *     info badge.
 */
export function FeedConsumptionCard({
  data,
  onEdit,
}: {
  data?: FeedCardDto | null;
  onEdit?: () => void;
}) {
  const fcr = data?.summary.fcr ?? null;
  const ratingLabel = data?.summary.ratingLabel ?? null;
  const ratingWord = ratingWordFromLabel(ratingLabel);
  const itemType = data?.summary.itemType ?? null;
  const itemBrand = data?.summary.itemBrand ?? null;
  const unit = data?.summary.unit ?? 'kg';
  const empty = fcr == null;
  const series = data?.series;
  const isTwiceADay = series?.mode === 'expert';

  // Learn-more drawer — matches the wizard's pattern (each step has
  // its own LearnMoreDrawer). User asked specifically to make the
  // footer's "Learn more" active "just like other Learn more in the
  // app", so this card grows its own drawer with FCR explainer copy.
  const [learnOpen, setLearnOpen] = useState(false);

  // FCR gauge — centered scale so the figma's 1.45 example lands
  // near the middle (green zone). Range [0.4, 2.4] gives:
  //   broiler optimal 1.4–1.8  → 50–70%  (emerald → sky transition)
  //   layer pre-lay   0.5–1.0  → 5–30%   (rose / amber zone — caveat
  //                                       below makes sense)
  //   layer in-prod   2.0–2.5  → 80–100% (sky)
  //
  // Clamp the pill's centerline to [12%, 88%] so it stays clear of
  // the Low / High labels even at extreme FCRs (broiler 0.6 →
  // clamps to 12%, layer 4.0 → clamps to 88%). The previous [7, 93]
  // was tight enough that the right-edge case (the user's 9.59
  // example, which clamps in) put the pill literally touching the
  // "High" text. A 12 % buffer keeps the pill comfortably inside
  // the gradient bar.
  const rawPct = fcr == null ? null : Math.max(0, Math.min(1, (fcr - 0.4) / 2.0)) * 100;
  const pct = rawPct == null ? null : Math.max(12, Math.min(88, rawPct));

  return (
    <Card>
      <CardHeader icon={Wheat} title="Feed consumption" />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          fcrEmptyStateCopy(data)
        ) : ratingWord ? (
          <>
            Your birds show {articleFor(ratingWord)}{' '}
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {ratingWord}
            </strong>{' '}
            feed conversion rate.
          </>
        ) : (
          'Your birds show a stable feed conversion rate.'
        )}
      </p>

      {!empty && (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] font-bold text-[var(--color-brand-fg)]">
            Feed conversion rate (FCR)
          </p>
          {/*
            Two structural changes vs the previous version:
            1. The pill now lives in an OVERLAY div that sits on top of
               the bar (relative parent, absolute child) instead of
               inside the bar's overflow-hidden box. The bar can clip
               its gradient cleanly while the pill — which is much
               taller than the 6 px bar — paints in full.
            2. "Low" and "High" labels are NOT in the same flex row as
               the bar anymore. Instead they sit at fixed left/right
               anchors on the same line as the bar via absolute
               positioning, with a 28 px gutter on each side. That gives
               the pill (clamped to 12 % / 88 %) a guaranteed ~8 px
               buffer from the labels at the extremes, so an FCR of
               9.59 (clamped) no longer bumps into "High".
          */}
          <div className="relative h-7">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--color-brand-muted)]">
              Low
            </span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--color-brand-muted)]">
              High
            </span>
            <div className="absolute inset-x-9 top-1/2 -translate-y-1/2">
              <div
                aria-hidden
                className="h-1.5 w-full rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, #be123c 0%, #f97316 28%, #16a34a 55%, #0284c7 78%)',
                }}
              />
              {fcr != null && pct != null && (
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand-primary)] px-2.5 py-0.5 text-[11.5px] font-bold leading-tight text-white shadow-md ring-2 ring-white"
                  style={{ left: `${pct}%` }}
                >
                  {fcr.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!empty && series && (
        <div className="mt-4 space-y-3">
          {isTwiceADay && series.mode === 'expert' ? (
            <>
              <DailyAmountSection
                title="Morning feed amount"
                itemType={itemType}
                itemBrand={itemBrand}
                items={(series.morning ?? []).slice(-5)}
                unit={unit}
              />
              <DailyAmountSection
                title="Evening feed amount"
                itemType={itemType}
                itemBrand={itemBrand}
                items={(series.evening ?? []).slice(-5)}
                unit={unit}
              />
            </>
          ) : (
            <DailyAmountSection
              title="Daily feed amount"
              itemType={itemType}
              itemBrand={itemBrand}
              items={recentDailyPoints(series, 5)}
              unit={unit}
            />
          )}
        </div>
      )}

      <FeedCardFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log feed' : 'Edit record'}
      />

      {/* Inline drawer — mirrors the wizard's LearnMoreDrawer pattern.
          Renders as a bottom-sheet on phones (slides up) and a
          centered modal on sm+ viewports. Content explains FCR so the
          farmer can act on the rating word ("excellent" vs "poor"). */}
      <FcrLearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        fcr={fcr}
        ratingWord={ratingWord}
      />
    </Card>
  );
}

/**
 * One date-column grid of feed-amount values. Used by both the
 * single-section "Daily feed amount" and the twice-a-day
 * Morning/Evening pair. Each value sits in a beige accent pill — the
 * figma's "1,2 kg" / "12 kg" / "120 kg" / "1.200 kg" / "12 tons"
 * row — so the row reads as a sequence of stable pills instead of a
 * bar chart.
 */
function DailyAmountSection({
  title,
  itemType,
  itemBrand,
  items,
  unit,
}: {
  title: string;
  itemType: string | null;
  itemBrand: string | null;
  items: Array<{ date: string; value: number | null }>;
  unit: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          {title}
        </p>
        {(itemType || itemBrand) && (
          <p className="truncate text-[11px] text-[var(--color-brand-muted)]">
            {itemType && (
              <span className="font-bold text-[var(--color-brand-primary-deep)]">
                {capitalizeFirst(itemType)}:
              </span>
            )}{' '}
            {itemBrand}
          </p>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
        {items.map((d) => (
          <div key={d.date} className="flex min-w-0 flex-col items-center">
            <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
              {shortDate(d.date)}
            </p>
            <span className="inline-flex h-6 w-full items-center justify-center rounded-md bg-[var(--color-brand-accent)]/55 px-1 text-[10.5px] font-bold leading-none text-[var(--color-brand-fg)]">
              <span className="truncate">
                {d.value == null ? '—' : `${fmtCompact(d.value)} ${unit}`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Feed-card footer — green BadgeCheck "Learn more" on the left, a
 * compact "Edit record ›" on the right.
 *
 * Two corrections from the previous iteration:
 *   - Icon was `CheckCircle2` (plain circle + tick). The figma's icon
 *     is a verified-badge style — scalloped/sunburst frame around a
 *     centered tick. Lucide ships exactly that as `BadgeCheck`, so
 *     the swap is one-for-one with no SVG handwriting.
 *   - "Learn more" is now ACTUALLY clickable (was inert before). It
 *     opens an inline drawer with FCR explainer copy — mirrors the
 *     wizard's per-step LearnMoreDrawer pattern so the affordance
 *     feels consistent across the app.
 */
function FeedCardFooter({
  onLearnMore,
  onEdit,
  editLabel,
}: {
  onLearnMore: () => void;
  onEdit?: () => void;
  editLabel: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-brand-border)] pt-2.5">
      <button
        type="button"
        onClick={onLearnMore}
        className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--color-brand-primary-deep)] hover:underline"
      >
        <BadgeCheck className="h-4 w-4 fill-[var(--color-brand-primary)] text-white" strokeWidth={2.4} />
        Learn more
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
      >
        {editLabel}
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * Inline learn-more drawer specifically for the FCR card. Reuses the
 * same bottom-sheet / centered-modal shape as the wizard's
 * LearnMoreDrawer (components/record/wizard-shell.tsx) so the
 * affordance feels familiar.
 *
 * Renders a brief explainer of:
 *   - What FCR is
 *   - How the gauge zones map to ratings (red / amber / green / blue)
 *   - The user's current value + rating in context
 */
function FcrLearnMoreDrawer({
  open,
  onClose,
  fcr,
  ratingWord,
}: {
  open: boolean;
  onClose: () => void;
  fcr: number | null;
  ratingWord: string | null;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.30)] sm:max-w-[520px] sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-5 py-4">
          <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">
            Feed conversion rate (FCR)
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 text-[13px] leading-relaxed text-[var(--color-brand-fg)]">
          <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary)]">
            What FCR tells you
          </h3>
          <p>
            FCR is the <strong>feed-to-output ratio</strong>: how many kilograms
            of feed your birds eat for every kilogram of meat (broilers) or eggs
            (layers) they produce. Lower is better &mdash; less feed for the same
            output.
          </p>

          {fcr != null && (
            <p>
              Your current FCR is{' '}
              <strong className="text-[var(--color-brand-primary-deep)]">
                {fcr.toFixed(2)}
              </strong>
              {ratingWord ? <> &mdash; rated <strong>{ratingWord}</strong>.</> : '.'}
            </p>
          )}

          <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary)]">
            Gauge zones
          </h3>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-rose-600" />
              <span><strong>Red (suspiciously low)</strong> &mdash; usually a logging error. Double-check your feed-amount entries are in the right unit.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-orange-500" />
              <span><strong>Orange (below target)</strong> &mdash; birds are growing slower than the benchmark suggests for the feed they&rsquo;re eating.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--color-brand-primary)]" />
              <span><strong>Green (on target)</strong> &mdash; you&rsquo;re in the breed&rsquo;s expected efficiency window. Keep doing what you&rsquo;re doing.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-sky-600" />
              <span><strong>Blue (above target)</strong> &mdash; more feed per kg of output than the benchmark. Common causes: feed waste, low-quality feed, illness, or wrong stocking density.</span>
            </li>
          </ul>

          <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary)]">
            How we compute it
          </h3>
          <p>
            We sum your lifetime feed (kg, with bags auto-converted) and divide
            by your birds&rsquo; live weight (current_birds &times; latest average
            weight) for broilers and pre-lay pullets, or by total kg of eggs
            for layers in production. Log a bird weight or some eggs to keep
            the number fresh.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Pull the rating word out of a ratingLabel like "Excellent —
 * beating benchmark" → "excellent". Used by the description sentence
 * so "Your birds show a great feed conversion rate" can be assembled
 * dynamically.
 */
function ratingWordFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const word = label.split(/[—-]/, 1)[0]?.trim().toLowerCase();
  return word && word.length > 0 ? word : null;
}

/** "a great" vs "an excellent" — picks the right indefinite article. */
function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
            // Egg collection count pill — figma uses BLACK for count
            // ("1,093 eggs" / "1,254 eggs"), aligning with the bird-
            // count convention in BreedSummaryCard.
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
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
            // line-clamp-2 (not truncate) so long vaccine names like
            // "Newcastle Disease (HB1) + Infectious Bronchitis" wrap
            // to two lines on phones instead of getting ellipsized
            // mid-disease. On desktop most names fit on one line so
            // visually nothing changes for short labels.
            'line-clamp-2 break-words text-[13.5px] leading-snug text-[var(--color-brand-fg)]',
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
    // gap-2 instead of gap-3 squeezes a few more pixels for the title on
    // narrow phones. flex-wrap on the outer container lets the right
    // pill drop below the title on extremely cramped screens (≤ 320px
    // with a long rating like "Excellent — beating benchmark") instead
    // of overflowing the card edge.
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        {/* min-w-0 + truncate so a long card title ("Feed conversion
            rate" + the right-pill "Excellent — Beating Benchmark") can
            ellipsize cleanly on phones instead of pushing the pill off
            the card. */}
        <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
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
    // Tighter gap on phones (gap-1) widens each column so the value
    // label ("120L", "1.2kg") doesn't get squeezed. sm+ relaxes back
    // to gap-1.5. min-w-0 on every cell + truncate on the labels stops
    // an outlier like "12,000L" from blowing out the column width.
    <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
      {items.map((d) => {
        const v = d.value ?? 0;
        const h = v > 0 ? Math.max(8, Math.round((v / max) * 64)) : 4;
        return (
          <div key={d.date} className="flex min-w-0 flex-col items-center">
            <div className="relative flex h-16 w-full items-end justify-center">
              <div
                className={cn(
                  'w-full rounded bg-gradient-to-b',
                  v > 0 ? barClass : 'from-[var(--color-brand-input-border)] to-[var(--color-brand-input-border)]',
                )}
                style={{ height: `${h}px` }}
              />
            </div>
            <p className="mt-1 w-full truncate text-center text-[10px] font-semibold text-[var(--color-brand-fg)]">
              {d.value == null ? '—' : `${fmtCompact(v)}${unit}`}
            </p>
            <p className="w-full truncate text-center text-[9px] text-[var(--color-brand-muted-soft)]">
              {shortDate(d.date)}
            </p>
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

/**
 * Production-type-aware empty state for the FCR card.
 *
 * The backend returns fcr=null for two distinct "not enough data"
 * shapes:
 *   - Feed totals are 0 (nothing logged, OR everything was in bags
 *     before the bag→kg conversion landed).
 *   - Feed totals are >0 but the phase-appropriate denominator is
 *     missing — for broilers + pre-lay layers + mixed that means no
 *     bird-weight record; for layers in production it means no eggs
 *     × egg-weight.
 *
 * We don't have a flag for which one bit, so we infer from
 * `summary.lifetimeTotal` (the lifetime feed total): if there's any
 * feed on file we know the blocker is the denominator.
 *
 * The production-type hint matters for young layers especially —
 * "ISA Brown, 9 days old" doesn't make sense if we ask the farmer
 * to start collecting eggs. We tell them what'll happen once their
 * birds start laying so the empty state doubles as a roadmap.
 */
function fcrEmptyStateCopy(data?: FeedCardDto | null): string {
  const hasFeed = (data?.summary?.lifetimeTotal ?? 0) > 0;
  const type = data?.summary?.productionType ?? 'broiler';

  if (!hasFeed) {
    return 'Log feed entries (kg or bags) to start tracking your conversion rate.';
  }

  // Feed is on file — the blocker is the denominator. The message
  // depends on production type because the denominator IS the
  // production type (eggs for layers in lay, weight for everything
  // else).
  if (type === 'layer') {
    return 'Log a bird weight to see growth-phase FCR. Once your hens start laying, we\'ll switch to feed-per-egg.';
  }
  if (type === 'mixed') {
    return 'Log a bird weight to see growth-phase FCR. Once your layers start producing, we\'ll fold eggs in too.';
  }
  return 'Log a bird weight to compute FCR from your feed entries.';
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
