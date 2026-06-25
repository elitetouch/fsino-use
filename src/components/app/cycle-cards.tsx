'use client';

import { useState, type ReactNode } from 'react';
import {
  Bird, Droplet, Skull, Syringe, Wheat, ChevronRight, Egg, Scale, BadgeDollarSign,
  Check, BadgeCheck, X as XIcon, ChevronDown, CalendarPlus, Sparkles, Plus,
  type LucideIcon,
} from 'lucide-react';
import type {
  FeedCardDto, FlockDto, MortalityCardDto, BirdsSoldCardDto, WeightCardDto,
  EggCollectionCardDto, EggSizeCardDto, EggWeightCardDto, EggSeriesPoint,
  VaccinationCardDto, VaccinationItemDto, VaccinationOffScheduleItemDto,
  VaccinationSuggestionDto, WaterCardDto,
} from '@/lib/api';
import { useAddFarmExtraVaccination } from '@/lib/use-farm-extra-vaccinations';
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

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log feed' : 'Edit record'}
      />

      {/* Inline drawer — mirrors the wizard's LearnMoreDrawer pattern.
          Renders as a bottom-sheet on phones (slides up) and a
          centered modal on sm+ viewports. Content explains FCR so the
          farmer can act on the rating word ("excellent" vs "poor"). */}
      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Feed conversion rate (FCR)"
      >
        <FcrLearnMoreBody fcr={fcr} ratingWord={ratingWord} />
      </LearnMoreDrawer>
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
 * Unified card footer — green BadgeCheck "Learn more" on the left, a
 * compact "Edit record ›" on the right. Every data card on the dashboard
 * (Feed, Water, Mortality, Egg, Vaccination) renders this same shape so
 * the affordance is consistent — matches the figma's bottom-row treatment
 * across every dashboard card. The Learn more button always opens an
 * inline LearnMoreDrawer; the right slot can either be the edit button
 * (data cards) or a custom action like Show all (vaccination).
 *
 * Icon choice: BadgeCheck = verified-badge style — scalloped/sunburst
 * frame around a centered tick. Matches the figma exactly; CheckCircle2
 * would be a plain circle which is wrong.
 */
function LearnMoreFooter({
  onLearnMore,
  onEdit,
  editLabel,
  rightSlot,
}: {
  onLearnMore: () => void;
  /** Right-side edit button click. Omitted when rightSlot is supplied. */
  onEdit?: () => void;
  editLabel?: string;
  /** Override the right side entirely (e.g. vaccination's Show all toggle). */
  rightSlot?: ReactNode;
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
      {rightSlot ?? (editLabel ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
        >
          {editLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      ) : null)}
    </div>
  );
}

/**
 * Generic Learn-more drawer — bottom-sheet on phones, centered modal on
 * sm+ viewports. Every card renders this same chrome; the body changes
 * (FCR explainer for feed, water-intake explainer for water, etc.) so
 * the visual rhythm of the app stays consistent.
 */
function LearnMoreDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
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
          <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">{title}</p>
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
          {children}
        </div>
      </div>
    </div>
  );
}

/** Small heading shared by every drawer body so they all read the same. */
function DrawerSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary)]">
      {children}
    </h3>
  );
}

/** FCR card drawer body. */
function FcrLearnMoreBody({ fcr, ratingWord }: { fcr: number | null; ratingWord: string | null }) {
  return (
    <>
      <DrawerSectionHeading>What FCR tells you</DrawerSectionHeading>
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

      <DrawerSectionHeading>Gauge zones</DrawerSectionHeading>
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

      <DrawerSectionHeading>How we compute it</DrawerSectionHeading>
      <p>
        We sum your lifetime feed (kg, with bags auto-converted) and divide
        by your birds&rsquo; live weight (current_birds &times; latest average
        weight) for broilers and pre-lay pullets, or by total kg of eggs
        for layers in production. Log a bird weight or some eggs to keep
        the number fresh.
      </p>
    </>
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

/**
 * Water consumption card — rebuilt to match the figma "Easy / Expert /
 * First entry state / Empty state" frames exactly, mirroring the feed
 * card's treatment so every dashboard card reads as a consistent pair.
 *
 * Layout (top → bottom):
 *
 *   [icon] Water consumption                            [black 420ml pill]
 *   Over the last five days, you have provided a daily
 *   average of 420ml of water per bird.
 *
 *   Daily water amount      (or Morning / Evening sections in expert)
 *   Jan 1   Jan 2   Jan 3   Jan 4   Jan 5
 *   [1,2l]  [12l]   [120l]  [1.200l][12.000l]
 *
 *   ✓ Learn more                                            Edit record ›
 *
 * Critical deltas vs the previous DailyBars treatment:
 *
 *   - Bar chart REMOVED. Figma is a pill grid identical to the feed
 *     card; bars made the row taller and the values harder to scan.
 *   - Header pill is the bird-count style (black background) showing
 *     just "420ml" — the bird-per-day context lives in the body
 *     sentence instead, matching the figma's compact pill.
 *   - Empty state replaces the daily/morning/evening pill grids with
 *     "No water amount entered." inline copy under each section
 *     heading, matching the figma's "Empty state" frame.
 *   - Twice-a-day (expert) preference splits into Morning + Evening
 *     sections, same structural pattern as the feed card.
 */
export function WaterConsumptionCard({
  data,
  onEdit,
}: {
  data?: WaterCardDto | null;
  onEdit?: () => void;
}) {
  const avg = data?.summary.avgMlPerBirdPerDay ?? null;
  const series = data?.series;
  const isTwiceADay = series?.mode === 'expert';
  const empty = avg == null;
  const [learnOpen, setLearnOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        icon={Droplet}
        title="Water consumption"
        rightSlot={
          avg != null ? (
            // Black pill matches the figma's "420ml" badge. Bird-count
            // and egg-collection cards already use this treatment; reusing
            // it here keeps the count-style pills visually grouped.
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {Math.round(avg)}ml
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No water amount entered.'
        ) : (
          <>
            Over the last five days, you have provided a daily average of{' '}
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {Math.round(avg!)}ml of water
            </strong>{' '}
            per bird.
          </>
        )}
      </p>

      <div className="mt-4 space-y-3">
        {isTwiceADay && series?.mode === 'expert' ? (
          <>
            <WaterAmountSection
              title="Morning water amount"
              items={(series.morning ?? []).slice(-5)}
              empty={empty}
            />
            <WaterAmountSection
              title="Evening water amount"
              items={(series.evening ?? []).slice(-5)}
              empty={empty}
            />
          </>
        ) : (
          <WaterAmountSection
            title="Daily water amount"
            items={recentDailyPoints(series, 5)}
            empty={empty}
          />
        )}
      </div>

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log water' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Water consumption"
      >
        <WaterLearnMoreBody avg={avg} />
      </LearnMoreDrawer>
    </Card>
  );
}

/**
 * One section of the water card: section title + either the 5-column
 * pill grid OR the "No water amount entered." placeholder text used in
 * the figma's empty-state frame.
 *
 * Separate from DailyAmountSection (used by the feed card) because the
 * empty-state copy and the lack of brand/itemType right slot are
 * specific to water — folding the variants into a single component
 * would muddy the prop signature.
 */
function WaterAmountSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ date: string; value: number | null }>;
  empty: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
        {title}
      </p>
      {empty ? (
        <p className="text-[11.5px] italic text-[var(--color-brand-muted)]">
          No water amount entered.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {items.map((d) => (
            <div key={d.date} className="flex min-w-0 flex-col items-center">
              <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
                {shortDate(d.date)}
              </p>
              <span className="inline-flex h-6 w-full items-center justify-center rounded-md bg-[var(--color-brand-accent)]/55 px-1 text-[10.5px] font-bold leading-none text-[var(--color-brand-fg)]">
                <span className="truncate">
                  {d.value == null ? '—' : `${fmtCompact(d.value)} l`}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WaterLearnMoreBody({ avg }: { avg: number | null }) {
  return (
    <>
      <DrawerSectionHeading>Why daily water matters</DrawerSectionHeading>
      <p>
        Birds drink roughly 1.8&times; what they eat by weight. A sudden drop in
        water intake is often the <strong>first warning sign</strong> of illness
        or heat stress &mdash; usually a day or two before mortality climbs.
      </p>
      {avg != null && (
        <p>
          Your birds currently average{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {Math.round(avg)} ml per bird per day
          </strong>.
        </p>
      )}
      <DrawerSectionHeading>Typical ranges</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li>Broilers: 150&ndash;300 ml/bird/day, rising with age.</li>
        <li>Layers in production: 200&ndash;350 ml/bird/day.</li>
        <li>Hot weather can push intake 50&ndash;100% higher.</li>
      </ul>
      <DrawerSectionHeading>What to do</DrawerSectionHeading>
      <p>
        Log water daily &mdash; even an estimate. A 20% week-on-week drop is
        worth investigating: check waterlines, drinker height, and bird
        behaviour before it becomes a mortality spike.
      </p>
    </>
  );
}

// ────────────── MORTALITY ──────────────

/**
 * Mortality card — rebuilt to match the figma frames exactly.
 *
 *   [icon] Mortality rate                          [black "2,1%" pill]
 *   Your flock shows a [low] mortality rate, a total of 23 birds have
 *   died or were culled.
 *
 *   Birds dead or culled
 *   Jan 1  Jan 2  Jan 3  Jan 4  Jan 5
 *   [0]    [2]    [5]    [1]    [2]      ← "5" rendered red as the spike
 *
 *   Primary cause of death
 *   [Entered cause] was the primary cause of death.
 *
 *   ✓ Learn more                                      Edit record ›
 *
 * Critical deltas vs the previous DailyBars treatment:
 *   - Beige pill grid (no bars). Matches Feed/Water visual rhythm.
 *   - Black pill in header (figma "2,1%" is black, not coloured by rating).
 *   - Worst day in the visible window is rendered red to draw the eye —
 *     replaces the old per-bar rose gradient. Days with 0 stay neutral
 *     (a peaceful day shouldn't shout).
 *   - "Primary cause of death" surfaces as its own section with the
 *     figma's "[Entered cause] was the primary cause of death."
 *     sentence, not a single inline word.
 */
export function MortalityCard({
  data,
  onEdit,
}: {
  data?: MortalityCardDto | null;
  onEdit?: () => void;
}) {
  const rate = data?.summary.rate ?? null;
  const rateLabel = data?.summary.rateLabel ?? null;
  const totalDead = data?.summary.totalDead ?? 0;
  const items = recentDailyPoints(data?.series, 5);
  const empty = rate == null && totalDead === 0;
  const cause = data?.summary.primaryCause ?? null;
  const [learnOpen, setLearnOpen] = useState(false);

  // Worst day of the visible window — the column that gets the red
  // pill. Only highlight if there's a positive spike (a stretch of 0s
  // shouldn't pick any column).
  const maxValue = items.reduce(
    (m, d) => (typeof d.value === 'number' && d.value > m ? d.value : m),
    0,
  );

  // Strip the [brackets] off the rateLabel so we can drop the bracketed
  // word into the figma's "Your flock shows a [low] mortality rate"
  // sentence with proper styling — same pattern Feed uses for its
  // rating word.
  const rateWord = rateLabel
    ? rateLabel.replace(/[\[\]]/g, '').trim().toLowerCase()
    : null;

  return (
    <Card>
      <CardHeader
        icon={Skull}
        title="Mortality rate"
        rightSlot={
          rate != null ? (
            // Black pill — figma uses black for the headline % regardless
            // of rating word (the rating colour is conveyed in the
            // description sentence, not the pill).
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {rate.toFixed(1).replace('.', ',')}%
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No mortality logged yet.'
        ) : (
          <>
            Your flock shows {rateWord ? articleFor(rateWord) : 'a'}{' '}
            {rateWord && (
              <strong className="font-bold text-[var(--color-brand-primary-deep)]">
                {rateWord}
              </strong>
            )}{' '}
            mortality rate, a total of{' '}
            <strong className="font-bold text-[var(--color-brand-fg)]">
              {totalDead} bird{totalDead === 1 ? '' : 's'}
            </strong>{' '}
            {totalDead === 1 ? 'has' : 'have'} died or {totalDead === 1 ? 'was' : 'were'} culled.
          </>
        )}
      </p>

      <div className="mt-4">
        <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          Birds dead or culled
        </p>
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {items.map((d) => {
            const isSpike = typeof d.value === 'number' && d.value > 0 && d.value === maxValue;
            return (
              <div key={d.date} className="flex min-w-0 flex-col items-center">
                <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
                  {shortDate(d.date)}
                </p>
                <span className={cn(
                  'inline-flex h-6 w-full items-center justify-center rounded-md px-1 text-[10.5px] font-bold leading-none',
                  isSpike
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-fg)]',
                )}>
                  <span className="truncate">
                    {d.value == null ? '—' : Math.round(d.value).toString()}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          Primary cause of death
        </p>
        <p className="text-[12px] leading-snug text-[var(--color-brand-fg-soft)]">
          {cause ? (
            <>
              <strong className="font-bold text-[var(--color-brand-fg)]">{cause}</strong>{' '}
              was the primary cause of death.
            </>
          ) : (
            <span className="italic text-[var(--color-brand-muted)]">No primary cause recorded.</span>
          )}
        </p>
      </div>

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log mortality' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Mortality rate"
      >
        <MortalityLearnMoreBody rate={rate} rateLabel={rateLabel} />
      </LearnMoreDrawer>
    </Card>
  );
}

function MortalityLearnMoreBody({ rate, rateLabel }: { rate: number | null; rateLabel: string | null }) {
  return (
    <>
      <DrawerSectionHeading>What this number means</DrawerSectionHeading>
      <p>
        Mortality rate is the percentage of birds you&rsquo;ve lost since the
        cycle started &mdash; both natural deaths and culls. Tracking it
        day-by-day catches outbreaks early; a spike of 0.5&ndash;1% in a single
        day deserves a vet call.
      </p>
      {rate != null && (
        <p>
          Current rate is{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {rate.toFixed(2)}%
          </strong>
          {rateLabel ? <> &mdash; rated <strong>{rateLabel.toLowerCase()}</strong>.</> : '.'}
        </p>
      )}
      <DrawerSectionHeading>Typical benchmarks</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li><strong>Broilers:</strong> &lt; 5% cumulative over the cycle is healthy.</li>
        <li><strong>Layers:</strong> &lt; 1% per month in production is healthy.</li>
        <li>Brooding (week 1&ndash;2): expect 1&ndash;2%; higher means investigate.</li>
      </ul>
      <DrawerSectionHeading>Logging tip</DrawerSectionHeading>
      <p>
        Always record a <strong>cause</strong> alongside the count &mdash; over
        time, the primary-cause breakdown tells you whether to invest in
        biosecurity, climate, or feed quality.
      </p>
    </>
  );
}

// ────────────── BIRDS SOLD ──────────────

/**
 * Birds sold card — matches the figma "280 birds" / "100 birds" frames.
 *
 *   [icon] Birds sold                              [black "280 birds" pill]
 *   You have sold 19% of the birds in this pen.
 *
 *   Birds sold
 *   Jan 1  Feb 23 Mar 14 Apr 4  Apr 26
 *   [100]  [30]   [50]   [50]   [50]
 *
 * Unlike feed/water/mortality which are daily, sales are sporadic
 * events; the backend ships only the dates that actually have sales
 * (last 5), so this card renders N columns where N ≤ 5 — matching the
 * figma's "first entry state" with a single Jan 1 column.
 */
export function BirdsSoldCard({
  data,
  onEdit,
}: {
  data?: BirdsSoldCardDto | null;
  onEdit?: () => void;
}) {
  const totalSold = data?.summary.totalSold ?? 0;
  const percent = data?.summary.percentOfFlock ?? null;
  const items = recentDailyPoints(data?.series, 5);
  const empty = totalSold === 0;
  const [learnOpen, setLearnOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        icon={BadgeDollarSign}
        title="Birds sold"
        rightSlot={
          totalSold > 0 ? (
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {totalSold.toLocaleString()} birds
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No birds sold from this pen yet.'
        ) : percent != null ? (
          <>
            You have sold{' '}
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {percent.toFixed(percent < 10 ? 1 : 0).replace('.', ',')}%
            </strong>{' '}
            of the birds in this pen.
          </>
        ) : (
          <>
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {totalSold.toLocaleString()}
            </strong>{' '}
            birds sold from this pen.
          </>
        )}
      </p>

      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Birds sold
          </p>
          <SporadicPillGrid items={items} renderValue={(v) => Math.round(v).toLocaleString()} />
        </div>
      )}

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log a sale' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Birds sold"
      >
        <BirdsSoldLearnMoreBody totalSold={totalSold} percent={percent} />
      </LearnMoreDrawer>
    </Card>
  );
}

function BirdsSoldLearnMoreBody({ totalSold, percent }: { totalSold: number; percent: number | null }) {
  return (
    <>
      <DrawerSectionHeading>What this tracks</DrawerSectionHeading>
      <p>
        Birds sold counts every bird that has left this pen as a sale &mdash;
        useful for tracking cash flow and seeing how the cycle is winding down.
        Combined with the mortality card, you get a complete picture of where
        every placed bird went.
      </p>
      {percent != null && (
        <p>
          You have sold{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {percent.toFixed(1)}%
          </strong>{' '}
          of the placed birds &mdash; {totalSold.toLocaleString()} birds in total.
        </p>
      )}
      <DrawerSectionHeading>Logging tip</DrawerSectionHeading>
      <p>
        Record the <strong>sale amount</strong> with each entry &mdash; the
        finance section uses these numbers to compute revenue and margin
        per cycle.
      </p>
    </>
  );
}

/**
 * Pill grid for SPORADIC events (weight, sales). Renders one column
 * per data point — variable width up to 5, not a fixed 5-column grid
 * with dashes. Matches the figma's "first entry state" frames which
 * show a single column when there's only one reading.
 */
function SporadicPillGrid({
  items,
  renderValue,
}: {
  items: Array<{ date: string; value: number | null }>;
  renderValue: (v: number) => string;
}) {
  if (items.length === 0) return null;
  // Grid that grows up to 5 columns then wraps; min-w-0 on each cell so
  // long values truncate inside their pill rather than blowing out.
  const cols = Math.min(5, items.length);
  return (
    <div
      className="grid gap-1 sm:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((d) => (
        <div key={d.date} className="flex min-w-0 flex-col items-center">
          <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
            {shortDate(d.date)}
          </p>
          <span className="inline-flex h-6 w-full items-center justify-center rounded-md bg-[var(--color-brand-accent)]/55 px-1 text-[10.5px] font-bold leading-none text-[var(--color-brand-fg)]">
            <span className="truncate">
              {d.value == null ? '—' : renderValue(d.value)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ────────────── BIRD WEIGHT ──────────────

/**
 * Bird weight card — matches the figma "1,71 kg" frame.
 *
 *   [icon] Bird weight                            [black "1,71 kg" pill]
 *   Your birds show [good] weight gain.
 *
 *   Average bird weight
 *   Jan 1   Jan 8   Jan 15  Jan 22  Jan 29
 *   [0,35]  [0,71]  [1,12]  [1,56]  [1,71] kg
 *
 * Sporadic event — backend ships the last 5 weigh-ins regardless of
 * calendar gap (weight is usually logged weekly). Grid width matches
 * available data so the figma's "first entry" single-column case is
 * native, not a "—" padding workaround.
 */
export function BirdWeightCard({
  data,
  onEdit,
}: {
  data?: WeightCardDto | null;
  onEdit?: () => void;
}) {
  const latest = data?.summary.latestAvgWeightKg ?? null;
  const statusLabel = data?.summary.statusLabel ?? null;
  const items = recentDailyPoints(data?.series, 5);
  const empty = latest == null;
  const [learnOpen, setLearnOpen] = useState(false);

  // Same rating-word pattern as the FCR and mortality descriptions —
  // strip the [brackets] backend ships around the rating word so it can
  // live inside the figma's "Your birds show [good] weight gain." sentence.
  const ratingWord = statusLabel
    ? statusLabel.replace(/[\[\]]/g, '').trim().toLowerCase()
    : null;

  return (
    <Card>
      <CardHeader
        icon={Scale}
        title="Bird weight"
        rightSlot={
          latest != null ? (
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {formatKg(latest)} kg
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No bird weight measurements yet.'
        ) : ratingWord ? (
          <>
            Your birds show {articleFor(ratingWord)}{' '}
            <strong className={cn(
              'font-bold',
              ratingWord === 'good' ? 'text-[var(--color-brand-primary-deep)]'
                : ratingWord === 'poor' ? 'text-rose-600'
                : 'text-[var(--color-brand-fg)]',
            )}>
              {ratingWord}
            </strong>{' '}
            weight gain.
          </>
        ) : (
          'Latest bird weight measurements across recent readings.'
        )}
      </p>

      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Average bird weight
          </p>
          <SporadicPillGrid items={items} renderValue={(v) => `${formatKg(v)} kg`} />
        </div>
      )}

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log a weight' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Bird weight"
      >
        <BirdWeightLearnMoreBody latest={latest} ratingWord={ratingWord} />
      </LearnMoreDrawer>
    </Card>
  );
}

function BirdWeightLearnMoreBody({ latest, ratingWord }: { latest: number | null; ratingWord: string | null }) {
  return (
    <>
      <DrawerSectionHeading>Why weight matters</DrawerSectionHeading>
      <p>
        Average bird weight is the cleanest signal of <strong>growth and feed
        efficiency</strong>. Weigh a representative sample weekly so the FCR
        denominator stays fresh and the trend line tells you when feed type,
        environment or health needs attention.
      </p>
      {latest != null && (
        <p>
          Latest reading is{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {formatKg(latest)} kg
          </strong>
          {ratingWord ? <> &mdash; rated <strong>{ratingWord}</strong>.</> : '.'}
        </p>
      )}
      <DrawerSectionHeading>How we rate gain</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li><strong>Good</strong> &mdash; latest reading is at least 2% above the first in the window.</li>
        <li><strong>Flat</strong> &mdash; within ±2%; usually means investigate.</li>
        <li><strong>Poor</strong> &mdash; latest reading is at least 2% lower; rare and serious.</li>
      </ul>
      <DrawerSectionHeading>Logging tip</DrawerSectionHeading>
      <p>
        Weigh the same 10&ndash;20 birds at the same time of day each week
        &mdash; bird-to-bird variation otherwise drowns out the real growth
        signal.
      </p>
    </>
  );
}

/** "1.71" → "1,71" matching the figma's European decimal style. */
function formatKg(v: number): string {
  const rounded = Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  return rounded.replace('.', ',');
}

// ────────────── EGG COLLECTION ──────────────

/**
 * Egg collection card — rebuilt to match the figma's four egg-collection
 * frames exactly (easy / expert / first-entry / partial-empty).
 *
 *   Easy mode (once-a-day pref):
 *     [icon] Egg collection                      [black "1,093 eggs" pill]
 *     Over the last five days, your birds have laid an average of
 *     1,093 eggs per day.
 *
 *     Eggs collected
 *     Jan 1  Jan 2  Jan 3  Jan 4  Jan 5
 *     [1,254][1,231][1,092][1,087][1,254]
 *
 *   Expert mode (twice-a-day pref) — two sections, each with Good and
 *   Damaged sub-rows:
 *
 *     Morning egg collection
 *               Jan 2  Jan 3  Jan 4  Jan 5
 *     Good:    [1,231][1,092][1,087][1,254]
 *     Damaged: [28]   [11]   [43]   [27]      ← worst "Damaged" rendered red
 *
 *     Evening egg collection ... (same layout, sharp drop in Good rendered red)
 *
 *   Footer: ✓ Learn more                                    Edit record ›
 *
 * Description sentence reads "Over the last N days, your birds have laid
 * an average of X eggs per day." where N = data-day count in the
 * displayed window — matches the figma's "last four days" copy when
 * Jan 1 had no data.
 */
export function EggCollectionCard({
  data,
  onEdit,
}: {
  data?: EggCollectionCardDto | null;
  onEdit?: () => void;
}) {
  const avgPerDay = data?.summary.dailyAverage ?? null;
  const lifetimeGood = data?.summary.lifetimeGood ?? 0;
  const lifetimeDamaged = data?.summary.lifetimeDamaged ?? 0;
  const layRate = data?.summary.layRate ?? null;
  const series = data?.series ?? null;
  const isTwiceADay = series?.mode === 'expert';

  // Pick the per-section items (last 5) for the morning / evening split,
  // or the daily series for the once-a-day layout. The frontend trims
  // to 5; backend already ships exactly 5.
  const morningItems = isTwiceADay && series?.mode === 'expert' ? series.morning.slice(-5) : [];
  const eveningItems = isTwiceADay && series?.mode === 'expert' ? series.evening.slice(-5) : [];
  const dailyItems = !isTwiceADay && (series?.mode === 'easy' || series?.mode === 'daily')
    ? series.daily.slice(-5)
    : [];

  // Count of days with at least one record — drives the "last N days"
  // copy. For twice-a-day, a day counts if EITHER moment recorded.
  const dataDayCount = isTwiceADay
    ? new Set(
        [...morningItems, ...eveningItems]
          .filter((p) => p.hasRecord)
          .map((p) => p.date),
      ).size
    : dailyItems.filter((p) => p.hasRecord).length;

  const empty = lifetimeGood === 0 && dataDayCount === 0;
  const [learnOpen, setLearnOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        icon={Egg}
        title="Egg collection"
        rightSlot={
          avgPerDay != null ? (
            // Black "1,093 eggs" pill — same treatment as the bird-count
            // / birds-sold pills, deliberately count-style not rating-coloured.
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {Math.round(avgPerDay).toLocaleString()} eggs
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No eggs collected yet.'
        ) : avgPerDay != null && dataDayCount > 0 ? (
          <>
            Over the last {numberWord(dataDayCount)} day{dataDayCount === 1 ? '' : 's'},
            your birds have laid an average of{' '}
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {Math.round(avgPerDay).toLocaleString()} eggs per day
            </strong>
            .
          </>
        ) : (
          'Eggs collected across recent days.'
        )}
      </p>

      <div className="mt-4 space-y-4">
        {isTwiceADay ? (
          <>
            <EggMomentSection title="Morning egg collection" items={morningItems} />
            <EggMomentSection title="Evening egg collection" items={eveningItems} />
          </>
        ) : (
          <EggDailySection title="Eggs collected" items={dailyItems} />
        )}
      </div>

      {/* Lifetime damaged-eggs hint stays as a secondary tooltip-style
          line for both modes — useful context that doesn't fit in the
          per-day pills. Hidden when no damage has ever been logged. */}
      {lifetimeDamaged > 0 && (
        <p className="mt-3 text-[11.5px] text-[var(--color-brand-fg-soft)]">
          Lifetime:{' '}
          <strong className="text-[var(--color-brand-fg)]">
            {lifetimeGood.toLocaleString()} good
          </strong>
          {' · '}
          <span className="text-rose-700">
            {lifetimeDamaged.toLocaleString()} damaged
          </span>
          {layRate != null ? <> · lay rate {layRate.toFixed(1)}%</> : null}
        </p>
      )}

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log eggs' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Egg collection"
      >
        <EggLearnMoreBody layRate={layRate} avgPerDay={avgPerDay} />
      </LearnMoreDrawer>
    </Card>
  );
}

/**
 * Daily section for once-a-day pref — one row of total-eggs pills, like
 * the figma "Eggs collected" row. Simple: just shows the day's good
 * count, dashes for missing days. Renders as many columns as the
 * backend ships (1 on first-entry, up to 5 normally).
 */
function EggDailySection({
  title,
  items,
}: {
  title: string;
  items: EggSeriesPoint[];
}) {
  if (items.length === 0) return null;
  const cols = Math.min(5, items.length);
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
        {title}
      </p>
      <div
        className="grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.map((d) => (
          <div key={d.date} className="flex min-w-0 flex-col items-center">
            <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
              {shortDate(d.date)}
            </p>
            <span className="inline-flex h-6 w-full items-center justify-center rounded-md bg-[var(--color-brand-accent)]/55 px-1 text-[10.5px] font-bold leading-none text-[var(--color-brand-fg)]">
              <span className="truncate">
                {d.value == null ? '—' : Math.round(d.value).toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Twice-a-day section — section title above a left-labeled grid with
 * two rows: "Good:" and "Damaged:". Mirrors the figma's "Morning egg
 * collection" / "Evening egg collection" blocks exactly.
 *
 * Outlier highlighting:
 *   - Good row: any value < 80% of the row's max gets the red pill —
 *     a sharp drop is the signal that warrants attention (the figma's
 *     "804" in the evening Good row).
 *   - Damaged row: the row max gets the red pill — a damage spike is
 *     the signal (the figma's "43").
 */
function EggMomentSection({
  title,
  items,
}: {
  title: string;
  items: EggSeriesPoint[];
}) {
  if (items.length === 0) return null;
  const cols = Math.min(5, items.length);

  const goodValues = items.map((i) => i.good ?? null);
  const damagedValues = items.map((i) => i.damaged ?? null);
  const goodMax = goodValues.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);
  const damagedMax = damagedValues.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);

  return (
    <div>
      <p className="mb-2 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
        {title}
      </p>

      <div className="space-y-1.5">
        {/* Date label row */}
        <div
          className="grid items-end gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `4.5rem repeat(${cols}, minmax(0, 1fr))` }}
        >
          <div />
          {items.map((d) => (
            <p key={d.date} className="w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
              {shortDate(d.date)}
            </p>
          ))}
        </div>

        {/* Good row */}
        <div
          className="grid items-center gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `4.5rem repeat(${cols}, minmax(0, 1fr))` }}
        >
          <p className="text-[11.5px] font-semibold text-[var(--color-brand-muted)]">Good:</p>
          {items.map((d) => {
            const isDrop = goodMax > 0
              && d.good != null
              && d.good < goodMax * 0.8;
            return (
              <span
                key={d.date}
                className={cn(
                  'inline-flex h-6 w-full items-center justify-center rounded-md px-1 text-[10.5px] font-bold leading-none',
                  isDrop
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-fg)]',
                )}
              >
                <span className="truncate">
                  {d.good == null ? '—' : Math.round(d.good).toLocaleString()}
                </span>
              </span>
            );
          })}
        </div>

        {/* Damaged row */}
        <div
          className="grid items-center gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `4.5rem repeat(${cols}, minmax(0, 1fr))` }}
        >
          <p className="text-[11.5px] font-semibold text-[var(--color-brand-muted)]">Damaged:</p>
          {items.map((d) => {
            const isSpike = damagedMax > 0
              && d.damaged != null
              && d.damaged > 0
              && d.damaged === damagedMax;
            return (
              <span
                key={d.date}
                className={cn(
                  'inline-flex h-6 w-full items-center justify-center rounded-md px-1 text-[10.5px] font-bold leading-none',
                  isSpike
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-fg)]',
                )}
              >
                <span className="truncate">
                  {d.damaged == null ? '—' : Math.round(d.damaged).toLocaleString()}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** "five" / "four" / "three" / "two" / "one" / fallback to digits. */
function numberWord(n: number): string {
  const words: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
  return words[n] ?? n.toString();
}

function EggLearnMoreBody({ layRate, avgPerDay }: { layRate: number | null; avgPerDay: number | null }) {
  return (
    <>
      <DrawerSectionHeading>What lay rate tells you</DrawerSectionHeading>
      <p>
        Lay rate is the percentage of your hens that laid an egg today. A flock
        of 1,000 layers producing 850 eggs has an 85% lay rate. It&rsquo;s the
        single best signal of layer-flock health and feed quality.
      </p>
      {layRate != null && (
        <p>
          Current rate is{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {layRate.toFixed(1)}%
          </strong>
          {avgPerDay != null ? <> ({Math.round(avgPerDay).toLocaleString()} eggs/day).</> : '.'}
        </p>
      )}
      <DrawerSectionHeading>Typical ranges</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li><strong>Peak lay (week 28&ndash;35):</strong> 90&ndash;95% for commercial layers.</li>
        <li><strong>Sustained lay (week 36&ndash;65):</strong> 80&ndash;88% is normal.</li>
        <li>A 5%+ drop in 48 hours warrants checking lighting, feed, and water.</li>
      </ul>
      <DrawerSectionHeading>Damaged eggs</DrawerSectionHeading>
      <p>
        Track damaged separately &mdash; a damaged-egg rate above 2&ndash;3%
        usually points at <strong>nest design, collection timing, or calcium
        deficiency</strong>, all of which are fixable.
      </p>
    </>
  );
}

// ────────────── EGG SIZE ──────────────

/**
 * Egg size card — matches the figma "Medium" frame.
 *
 *   [icon] Egg size                                   [black "Medium" pill]
 *   Your birds lay mostly [medium sized] eggs.
 *
 *   Egg size
 *   Jan 1   Jan 4   Jan 7   Jan 10  Jan 14
 *   [Small] [Medium][Jumbo] [Medium][Medium]
 *
 * Sporadic event — size grading is done weekly, so the backend ships
 * the last N graded dates regardless of calendar gap. Empty state shows
 * "No egg size grading yet." in place of the pill grid.
 */
export function EggSizeCard({
  data,
  onEdit,
}: {
  data?: EggSizeCardDto | null;
  onEdit?: () => void;
}) {
  const dominant = data?.summary.dominantSize ?? null;
  const series = data?.series ?? null;
  const items: Array<{ date: string; value: string | null }> = series && (series.mode === 'easy' || series.mode === 'daily')
    ? series.daily.slice(-5).map((p) => ({
        date: p.date,
        // EggSize series uses string values (e.g. "Medium") not numbers.
        // The reducer ships these as `value` so we read directly.
        value: typeof p.value === 'string' ? p.value : null,
      }))
    : [];
  const empty = !dominant && items.length === 0;
  const [learnOpen, setLearnOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        icon={Egg}
        title="Egg size"
        rightSlot={
          dominant ? (
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {dominant}
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No egg size grading yet.'
        ) : dominant ? (
          <>
            Your birds lay mostly{' '}
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {dominant.toLowerCase()} sized
            </strong>{' '}
            eggs.
          </>
        ) : (
          'Egg size readings across recent gradings.'
        )}
      </p>

      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Egg size
          </p>
          <SporadicCategoricalGrid items={items} highlight={dominant} />
        </div>
      )}

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log eggs' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Egg size"
      >
        <EggSizeLearnMoreBody dominant={dominant} />
      </LearnMoreDrawer>
    </Card>
  );
}

function EggSizeLearnMoreBody({ dominant }: { dominant: string | null }) {
  return (
    <>
      <DrawerSectionHeading>What egg size tracks</DrawerSectionHeading>
      <p>
        Grading by size tells you whether your flock has matured into its
        target egg-size band. Young layers start at <strong>Peewee</strong>
        / <strong>Small</strong> and trend up to <strong>Medium</strong> and
        <strong> Large</strong> as they age &mdash; an early plateau is a
        nutrition or lighting signal.
      </p>
      {dominant && (
        <p>
          Your birds&rsquo; dominant size is currently{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">{dominant}</strong>.
        </p>
      )}
      <DrawerSectionHeading>USDA / Nigerian grades</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li><strong>Peewee:</strong> &lt; 43 g per egg</li>
        <li><strong>Small:</strong> 43&ndash;53 g</li>
        <li><strong>Medium:</strong> 53&ndash;63 g</li>
        <li><strong>Large:</strong> 63&ndash;73 g</li>
        <li><strong>Extra Large / Jumbo:</strong> 73 g and above</li>
      </ul>
    </>
  );
}

/**
 * Pill grid for categorical sporadic values (e.g. egg-size labels).
 * Optional `highlight` value shows that pill in the brand-deep style,
 * letting the dominant grade pop visually within the row.
 */
function SporadicCategoricalGrid({
  items,
  highlight,
}: {
  items: Array<{ date: string; value: string | null }>;
  highlight: string | null;
}) {
  if (items.length === 0) return null;
  const cols = Math.min(5, items.length);
  return (
    <div
      className="grid gap-1 sm:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((d) => {
        const isDominant = !!highlight && d.value === highlight;
        return (
          <div key={d.date} className="flex min-w-0 flex-col items-center">
            <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
              {shortDate(d.date)}
            </p>
            <span className={cn(
              'inline-flex h-6 w-full items-center justify-center rounded-md px-1 text-[10.5px] font-bold leading-none',
              isDominant
                ? 'bg-[var(--color-brand-fg)] text-white'
                : 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-fg)]',
            )}>
              <span className="truncate">{d.value ?? '—'}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ────────────── EGG WEIGHT ──────────────

/**
 * Egg weight card — matches the figma "49 gram" frame.
 *
 *   [icon] Egg weight                                [black "49 gram" pill]
 *   Over the last five weighing, the average weight of a single egg
 *   was 49 grams.
 *
 *   Egg weight
 *   Jan 1   Jan 4   Jan 7   Jan 10  Jan 14
 *   [48]    [55]    [41]    [52]    [50]      ← min rendered red
 *
 * Sporadic — weight is sampled weekly. Outlier highlighting marks the
 * minimum reading (a sudden drop in egg weight is the warning signal;
 * a higher weight is rarely a concern).
 */
export function EggWeightCard({
  data,
  onEdit,
}: {
  data?: EggWeightCardDto | null;
  onEdit?: () => void;
}) {
  const avgG = data?.summary.avgWeightG ?? null;
  const unit = data?.summary.unit ?? 'g';
  const series = data?.series ?? null;
  const items = series && (series.mode === 'easy' || series.mode === 'daily')
    ? series.daily.slice(-5)
    : [];
  const dataCount = items.filter((p) => p.value != null).length;
  const empty = avgG == null && dataCount === 0;
  const [learnOpen, setLearnOpen] = useState(false);

  // Mark the minimum non-null reading in red — the figma's "41" sits
  // below the rest of the row to flag the worst sample.
  const minValue = items.reduce<number | null>((min, p) => {
    if (typeof p.value !== 'number') return min;
    return min == null || p.value < min ? p.value : min;
  }, null);

  return (
    <Card>
      <CardHeader
        icon={Scale}
        title="Egg weight"
        rightSlot={
          avgG != null ? (
            <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
              {Math.round(avgG)} gram
            </span>
          ) : undefined
        }
      />

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {empty ? (
          'No egg weight readings yet.'
        ) : avgG != null && dataCount > 0 ? (
          <>
            Over the last {numberWord(dataCount)} weighing{dataCount === 1 ? '' : 's'},
            the average weight of a single egg was{' '}
            <strong className="font-bold text-[var(--color-brand-primary-deep)]">
              {Math.round(avgG)} gram{Math.round(avgG) === 1 ? '' : 's'}
            </strong>
            .
          </>
        ) : (
          'Egg weight readings across recent samples.'
        )}
      </p>

      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Egg weight
          </p>
          <div
            className="grid gap-1 sm:gap-1.5"
            style={{ gridTemplateColumns: `repeat(${Math.min(5, items.length)}, minmax(0, 1fr))` }}
          >
            {items.map((d) => {
              const v = typeof d.value === 'number' ? d.value : null;
              const isWorst = minValue != null && v === minValue && items.length > 1;
              return (
                <div key={d.date} className="flex min-w-0 flex-col items-center">
                  <p className="mb-1 w-full truncate text-center text-[10.5px] font-medium text-[var(--color-brand-muted)]">
                    {shortDate(d.date)}
                  </p>
                  <span className={cn(
                    'inline-flex h-6 w-full items-center justify-center rounded-md px-1 text-[10.5px] font-bold leading-none',
                    isWorst
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-fg)]',
                  )}>
                    <span className="truncate">{v == null ? '—' : Math.round(v).toString()}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        onEdit={onEdit}
        editLabel={empty ? 'Log eggs' : 'Edit record'}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Egg weight"
      >
        <EggWeightLearnMoreBody avgG={avgG} unit={unit} />
      </LearnMoreDrawer>
    </Card>
  );
}

function EggWeightLearnMoreBody({ avgG, unit }: { avgG: number | null; unit: string }) {
  return (
    <>
      <DrawerSectionHeading>Why egg weight matters</DrawerSectionHeading>
      <p>
        Egg weight tracks <strong>shell quality and bird nutrition</strong> &mdash;
        a sudden drop usually means the flock is short on protein, calcium,
        or both. Sample 10&ndash;20 eggs and weigh them every week so the
        trend stays honest.
      </p>
      {avgG != null && (
        <p>
          Latest average is{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {Math.round(avgG)} {unit === 'g' ? 'grams' : unit}
          </strong>.
        </p>
      )}
      <DrawerSectionHeading>International grades (per egg)</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li><strong>Peewee:</strong> &lt; 43 g</li>
        <li><strong>Small:</strong> 43&ndash;53 g</li>
        <li><strong>Medium:</strong> 53&ndash;63 g</li>
        <li><strong>Large:</strong> 63&ndash;73 g</li>
        <li><strong>Extra Large / Jumbo:</strong> 73 g and above</li>
      </ul>
    </>
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
}: {
  data?: VaccinationCardDto | null;
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
  const [learnOpen, setLearnOpen] = useState(false);
  const [showOffSchedule, setShowOffSchedule] = useState(false);
  const ordered = chronologicalOrder(items);
  const VISIBLE_DEFAULT = 5;
  const visibleItems = showAll ? ordered : ordered.slice(0, VISIBLE_DEFAULT);

  const offSchedule = data?.offSchedule ?? [];
  const suggestions = data?.suggestions ?? [];

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

      {/* Phase 3 — cross-cycle suggestions. Surfaces vaccines the
          farmer has given off-protocol in 2+ recent closed cycles, so
          the system learns from practice rather than asking the
          farmer to re-add them every cycle. */}
      {suggestions.length > 0 && <SuggestionsBanner suggestions={suggestions} />}

      {/* List */}
      {visibleItems.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--color-brand-border)]">
          {visibleItems.map((row) => (
            <VaccinationRow key={row.id} item={row} />
          ))}
        </ul>
      )}

      {/* Phase 1 — "Other vaccines you've given" section. Records the
          farmer logged that didn't match any schedule row; visible so
          their effort is no longer silently dropped. Each row offers
          "+ Add to my protocol" (Phase 2 plumbing) which adopts the
          vaccine into the farm's standing protocol for future cycles. */}
      {offSchedule.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-3">
          <button
            type="button"
            onClick={() => setShowOffSchedule((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
                Other vaccines you&rsquo;ve given
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
                {offSchedule.length} entr{offSchedule.length === 1 ? 'y' : 'ies'} outside the schedule.
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-[var(--color-brand-fg-soft)] transition-transform',
                showOffSchedule && 'rotate-180',
              )}
            />
          </button>
          {showOffSchedule && (
            <ul className="mt-2 divide-y divide-[var(--color-brand-border)]">
              {offSchedule.map((row) => (
                <OffScheduleRow key={row.id} item={row} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Unified footer — same green BadgeCheck Learn more as every
          other card on the dashboard. The right slot carries the
          Show all toggle when the schedule is long enough to need
          collapsing, otherwise nothing — matches the figma's
          consistent footer treatment across all cards. */}
      <LearnMoreFooter
        onLearnMore={() => setLearnOpen(true)}
        rightSlot={ordered.length > VISIBLE_DEFAULT ? (
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
        ) : undefined}
      />

      <LearnMoreDrawer
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        title="Vaccination schedule"
      >
        <VaccinationLearnMoreBody
          completed={completed}
          total={total}
          overdue={overdue + criticalOverdue}
          dueToday={dueToday}
        />
      </LearnMoreDrawer>
    </Card>
  );
}

/**
 * Single row in the "Other vaccines you've given" section. Visual rhythm
 * mirrors the main schedule row — left date column + name middle +
 * action on the right — so the two lists scan as siblings.
 *
 * The "+ Add to my protocol" button calls
 * POST /vaccination-protocol/extras with the source_record_id so the
 * backend can trace the adoption back to the specific entry that
 * triggered it. After the mutation succeeds the dashboard query
 * invalidates and this row will be promoted to a schedule row in
 * future flocks (the materializer pulls farm extras at flock creation).
 */
function OffScheduleRow({ item }: { item: VaccinationOffScheduleItemDto }) {
  const add = useAddFarmExtraVaccination();

  const onAdopt = () => {
    add.mutate({
      name: item.name,
      kind: item.eventType,
      age_days: item.ageDays,
      source_record_id: item.recordId,
    });
  };

  return (
    <li className="flex items-center gap-3 px-2 py-2.5 -mx-2">
      <span className="inline-flex w-[3.4rem] shrink-0 items-center text-[10.5px] font-bold uppercase leading-tight tracking-[0.08em] text-[var(--color-brand-muted)]">
        {item.recordedDateLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-[var(--color-brand-fg)]">
          {item.name}
        </p>
        <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-brand-muted-soft)]">
          {item.eventType} · day {item.ageDays}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdopt}
        disabled={add.isPending}
        title="Add to my farm protocol"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-brand-border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--color-brand-primary-deep)] hover:bg-[var(--color-brand-accent)]/30 disabled:opacity-50"
      >
        {add.isPending ? '…' : <><Plus className="h-3 w-3" />Adopt</>}
      </button>
    </li>
  );
}

/**
 * Cross-cycle suggestions banner. Surfaces vaccines the farmer has
 * given off-protocol in 2+ recent closed cycles — the system noticing
 * a pattern and offering to standardise it without ever silently
 * changing the protocol.
 *
 * Each suggestion has its own "+ Add" tap — the banner can't bulk-add
 * because the farmer may want one and not another (e.g. they're sure
 * about Coccidiostat but only sometimes give the secondary
 * dewormer).
 */
function SuggestionsBanner({ suggestions }: { suggestions: VaccinationSuggestionDto[] }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-amber-900">
            Suggested for your protocol
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-amber-800">
            We noticed these {suggestions.length === 1 ? 'is' : 'are'} given consistently
            across your recent cycles — adopt {suggestions.length === 1 ? 'it' : 'them'} so
            future flocks include {suggestions.length === 1 ? 'it' : 'them'} automatically.
          </p>
        </div>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {suggestions.map((s) => (
          <SuggestionRow key={s.name + s.ageDays} suggestion={s} />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({ suggestion }: { suggestion: VaccinationSuggestionDto }) {
  const add = useAddFarmExtraVaccination();
  const onAdopt = () => {
    add.mutate({
      name: suggestion.name,
      kind: suggestion.eventType,
      age_days: suggestion.ageDays,
    });
  };
  return (
    <li className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1.5">
      <CalendarPlus className="h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={2.2} />
      <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--color-brand-fg)]">
        {suggestion.name}{' '}
        <span className="font-normal text-[var(--color-brand-muted)]">
          · day {suggestion.ageDays} · {suggestion.cycleCount} cycles
        </span>
      </p>
      <button
        type="button"
        onClick={onAdopt}
        disabled={add.isPending}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
      >
        {add.isPending ? '…' : <><Plus className="h-3 w-3" />Adopt</>}
      </button>
    </li>
  );
}

function VaccinationLearnMoreBody({
  completed, total, overdue, dueToday,
}: {
  completed: number; total: number; overdue: number; dueToday: number;
}) {
  return (
    <>
      <DrawerSectionHeading>How the schedule works</DrawerSectionHeading>
      <p>
        The schedule is generated from your flock&rsquo;s <strong>breed</strong>
        {' '}and <strong>placement date</strong>. Each row shows the calendar
        date the dose is due; the right-side indicator tells you whether it
        was given, missed, or upcoming.
      </p>
      {total > 0 && (
        <p>
          You&rsquo;ve completed{' '}
          <strong className="text-[var(--color-brand-primary-deep)]">
            {completed} of {total}
          </strong>
          {' '}scheduled doses
          {overdue > 0 ? <>, with <strong className="text-rose-700">{overdue} overdue</strong></> : null}
          {dueToday > 0 ? <>, and <strong>{dueToday} due today</strong></> : null}
          .
        </p>
      )}
      <DrawerSectionHeading>Reading the indicators</DrawerSectionHeading>
      <ul className="space-y-1.5">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" strokeWidth={3} />
          <span><strong>Green check</strong> &mdash; dose was given. We matched it from your daily records.</span>
        </li>
        <li className="flex items-start gap-2">
          <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" strokeWidth={3} />
          <span><strong>Red X</strong> &mdash; dose was missed. Critical vaccines (Newcastle, Gumboro, Marek&rsquo;s) shown in deeper red.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 inline-block h-[3px] w-4 shrink-0 rounded-full bg-[var(--color-brand-border)]" />
          <span><strong>Grey dash</strong> &mdash; upcoming, no action needed yet.</span>
        </li>
      </ul>
      <DrawerSectionHeading>Why this matters</DrawerSectionHeading>
      <p>
        Missing a critical vaccine at the wrong age can wipe out a pen.
        Log vaccinations <strong>the day you give them</strong> &mdash; we&rsquo;ll
        auto-match them against the schedule so a green check appears here.
      </p>
    </>
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

/**
 * Pull the last `n` daily points from any series shape, in chronological
 * order. Crucially, days WITHOUT records are preserved with value=null
 * so the UI can render them as "—" — the figma's "any day with no
 * record shows a dash" rule, which would silently collapse if we
 * filtered nulls out at the merge step.
 */
function recentDailyPoints(
  series:
    | { mode: 'easy' | 'daily'; daily?: Array<{ date: string; value: number | null }> }
    | { mode: 'expert'; morning?: Array<{ date: string; value: number | null }>; evening?: Array<{ date: string; value: number | null }> }
    | undefined,
  n: number,
): Array<{ date: string; value: number | null }> {
  if (!series) return [];
  if (series.mode === 'expert') {
    // Backend ships morning + evening sharing the same date set. Walk
    // morning's dates as the spine; combine each date's morning and
    // evening values; null when BOTH halves are missing so the day
    // still appears as a "—" column instead of being dropped.
    const morning = series.morning ?? [];
    const evening = series.evening ?? [];
    const eveningByDate = new Map<string, number | null>();
    for (const p of evening) eveningByDate.set(p.date, p.value);

    const merged = morning.map((m) => {
      const eVal = eveningByDate.get(m.date) ?? null;
      const both = (m.value == null && eVal == null)
        ? null
        : (m.value ?? 0) + (eVal ?? 0);
      return { date: m.date, value: both };
    });
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
