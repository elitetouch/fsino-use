'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  AlertTriangle, ArrowRight, Bird, ChevronDown, ClipboardList, Download, Droplet,
  FileText, Info, Loader2, Thermometer, TrendingUp, Wallet, Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import {
  apiErrorMessage, endpoints,
  type FlockDto, type FlockReportDetailedEntry, type FlockReportSummary, type PenDto,
} from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

/**
 * Reports page — accuracy-first cycle report a bank / co-op officer
 * can accept without follow-up questions.
 *
 * Design principles that shape every choice on this page:
 *   1. Pick one cycle, see one story. No cross-cycle roll-ups here —
 *      those are the next page.
 *   2. Show "—" when the underlying data is empty. Zero only appears
 *      when the count really was zero.
 *   3. Currency + units on every number. No naked "42".
 *   4. FCR only when both feed and weight data landed; otherwise say
 *      "insufficient data" rather than pretending.
 *   5. Climate section carries its coverage %, confidence tag, and a
 *      plain-English footnote so the reader can weigh how thin the
 *      PENKEEP stream was.
 *   6. Downloads (CSV + PDF) go through axios so the bearer token +
 *      X-Farm-ID ride along. Plain <a href> would 500 on the API-only
 *      backend.
 */
export default function ReportsPage() {
  const farmId = useCurrentFarmId();

  const flocks = useQuery({
    queryKey: ['flocks', farmId],
    queryFn: () => endpoints.listFlocks({ includeArchived: true }),
    enabled: !!farmId,
  });

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  const flockList = flocks.data?.flocks ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeFlock = useMemo<FlockDto | undefined>(() => {
    if (flockList.length === 0) return undefined;
    if (selectedId) {
      const match = flockList.find((f) => f.id === selectedId);
      if (match) return match;
    }
    // Default: newest by start_date (most likely what the farmer wants).
    return flockList.slice().sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];
  }, [flockList, selectedId]);

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden">
      <PageHeader
        eyebrow="Reports"
        title="Cycle reports"
        description="A shareable summary of any cycle — feed used, mortality, cost, revenue, PENKEEP climate. Export as PDF for banks and co-ops, or CSV for your own spreadsheets."
      />

      {flocks.isLoading || pens.isLoading ? (
        <PageSkeleton />
      ) : flockList.length === 0 ? (
        <EmptyState />
      ) : activeFlock ? (
        <>
          <CyclePicker
            cycles={flockList}
            pens={pens.data?.pens ?? []}
            value={activeFlock.id}
            onChange={setSelectedId}
          />
          <CycleReport flockId={activeFlock.id} pens={pens.data?.pens ?? []} />
        </>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── cycle picker ─────────────────────────── */

function CyclePicker({
  cycles, pens, value, onChange,
}: {
  cycles: FlockDto[];
  pens: PenDto[];
  value: string;
  onChange: (id: string) => void;
}) {
  const sorted = useMemo(
    () => cycles.slice().sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    [cycles],
  );
  const penName = (id: string | null | undefined) =>
    pens.find((p) => p.id === id)?.name ?? '—';

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
        Cycle
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block h-11 w-full appearance-none rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white pl-3.5 pr-9 text-[14px] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
        >
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.breed} · {penName(c.penId)} · placed {c.startDate?.slice(0, 10) ?? '—'}
              {c.archivedAt ? ' · archived' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-muted)]" />
      </div>
    </label>
  );
}

/* ─────────────────────────── cycle report ─────────────────────────── */

function CycleReport({ flockId, pens }: { flockId: string; pens: PenDto[] }) {
  const report = useQuery({
    queryKey: ['flock-report', flockId],
    queryFn: () => endpoints.getFlockReportSummary(flockId),
    enabled: !!flockId,
  });

  if (report.isLoading) return <PageSkeleton />;
  if (report.isError || !report.data) return <ErrorState error={report.error} />;

  const d = report.data;
  const pen = pens.find((p) => p.id === d.flock.penId);
  const currency = d.flock.currency ?? 'NGN';

  return (
    <div className="space-y-5">
      <CycleHead flock={d.flock} pen={pen} summary={d.summary} />
      <SummaryKpis summary={d.summary} currency={currency} />
      <FinancialsCard summary={d.summary} currency={currency} productionType={d.flock.productionType} />
      <ClimateCard climate={d.climate} />
      <VaccinationLog rows={d.vaccinations ?? []} currency={currency} />
      <TreatmentLog rows={d.treatments ?? []} currency={currency} />
      <BreakdownCard breakdown={d.breakdown} currency={currency} />
      <RecommendationsBlock recommendations={d.recommendations ?? []} />
      <ExportsRow flockId={flockId} />
      <AccuracyNotes />
    </div>
  );
}

/* ─────────────────────────── header block ─────────────────────────── */

function CycleHead({
  flock, pen, summary,
}: {
  flock: FlockReportSummary['flock'];
  pen: PenDto | undefined;
  summary: FlockReportSummary['summary'];
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-accent)]/60 to-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            {flock.productionType || 'flock'} · cycle report
          </p>
          <h1 className="mt-0.5 truncate text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[20px]">
            {flock.breed}
          </h1>
          <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
            {pen?.name ?? 'No pen'} · Started {fmtDate(flock.startDate)}
            {flock.archivedAt ? <> · <span className="text-amber-700">Archived {fmtDate(flock.archivedAt)}</span></> : null}
          </p>
          {/* Corrections chip — surfaces the count of append-only
              reversal entries so a bank/co-op reader knows to skim the
              records CSV for the reasons. Aggregations on this page
              already use the NET (original + correction). */}
          {(summary.correctionsCount ?? 0) > 0 && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
              {summary.correctionsCount} correction{summary.correctionsCount === 1 ? '' : 's'} applied
            </p>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-3 sm:gap-4">
          <MiniStat label="Days" value={formatCount(summary.daysElapsed)} sub="days old today" />
          <MiniStat label="Placed" value={formatCount(summary.birdsPlaced)} sub="birds at start" />
          <MiniStat label="Now" value={formatCount(summary.birdsNow)} sub="active birds" />
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-bold tabular-nums text-[var(--color-brand-fg)] sm:text-[17px]">
        {value}
      </p>
      <p className="text-[10px] text-[var(--color-brand-muted)]">{sub}</p>
    </div>
  );
}

/* ─────────────────────────── KPI grid ─────────────────────────── */

function SummaryKpis({
  summary, currency,
}: { summary: FlockReportSummary['summary']; currency: string }) {
  const cards: Array<{
    icon: typeof Bird;
    label: string;
    value: string;
    sub: string;
    tone: 'mint' | 'amber' | 'rose' | 'sky';
  }> = [
    {
      icon: AlertTriangle,
      label: 'Mortality',
      value: summary.mortalityCount === 0 && summary.birdsPlaced === 0
        ? '—'
        : `${formatCount(summary.mortalityCount)} (${formatPct(summary.mortalityPct)})`,
      // Tell the reader HOW mortality was computed — direct mortality
      // entries vs inferred from the drop between placed birds and the
      // latest bird_count snapshot. Never leave them guessing.
      sub: summary.mortalitySource === 'bird_count_delta'
        ? 'inferred from bird counts'
        : 'from mortality entries',
      tone: summary.mortalityPct > 8 ? 'rose' : summary.mortalityPct > 4 ? 'amber' : 'mint',
    },
    {
      icon: ClipboardList,
      label: 'Feed',
      value: summary.feedKg > 0 ? `${formatDecimal(summary.feedKg, 1)} kg` : '—',
      sub: 'normalised to kg',
      tone: 'sky',
    },
    {
      icon: TrendingUp,
      label: 'FCR',
      value: summary.fcr !== null ? formatDecimal(summary.fcr, 2) : '—',
      // FCR needs at least two weight events (an initial and a later
      // one) to compute an honest gain. When we can't compute one, the
      // card explains what's missing so the farmer knows what to log
      // rather than seeing "76.19" and wondering how it got there.
      sub: summary.fcr !== null
        ? 'feed ÷ (weight gain × birds)'
        : 'need feed + 2+ weight logs',
      tone: 'mint',
    },
    {
      icon: Wallet,
      label: 'Margin',
      value: formatMoney(summary.margin, currency),
      // When birds were sold without a price captured, the sub-label has
      // to say so. A farm that sold most of its flock through the daily
      // bird-count step otherwise reads as a total loss on the headline
      // KPI a farmer screenshots for a lender.
      sub: summary.revenueCompleteness?.hasUnpricedSales
        ? `incomplete · ${summary.revenueCompleteness.birdsSoldUnpriced} sold birds unpriced`
        : 'revenue − total cost',
      tone: summary.revenueCompleteness?.hasUnpricedSales
        ? 'amber'
        : summary.margin >= 0 ? 'mint' : 'rose',
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => <KpiCard key={c.label} {...c} />)}
    </section>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, tone,
}: {
  icon: typeof Bird;
  label: string;
  value: string;
  sub: string;
  tone: 'mint' | 'amber' | 'rose' | 'sky';
}) {
  const badge = tone === 'rose' ? 'bg-rose-50 text-rose-700'
    : tone === 'amber' ? 'bg-amber-50 text-amber-800'
    : tone === 'sky' ? 'bg-sky-50 text-sky-800'
    : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';

  return (
    <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', badge)}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">{label}</p>
      </div>
      <p className="mt-3 text-[22px] font-bold tabular-nums leading-none text-[var(--color-brand-fg)]">{value}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{sub}</p>
    </article>
  );
}

/* ─────────────────────────── financials ─────────────────────────── */

function FinancialsCard({
  summary, currency, productionType,
}: {
  summary: FlockReportSummary['summary'];
  currency: string;
  /** Broiler cycles never lay eggs — the revenue note skips the eggs
      caveat for them so the disclaimer stays honest about what
      matters. Layers and dual-purpose keep the caveat. */
  productionType: string;
}) {
  const revenueNote = productionType === 'broiler'
    ? 'Sale records only.'
    : 'Sale records only. Eggs not priced until you log a sale.';

  const rows: Array<{ label: string; value: string; note: string; strong?: boolean }> = [
    {
      label: 'Placement cost',
      value: formatMoney(summary.placementCost, currency),
      note: 'Cost of buying the birds at placement.',
    },
    {
      label: 'Operating expenses',
      value: formatMoney(summary.expenses, currency),
      note: 'Feed, water, vaccination and treatment records combined.',
    },
    {
      label: 'Total cost',
      value: formatMoney(summary.totalCost, currency),
      note: 'Placement + operating.',
      strong: true,
    },
    {
      label: 'Revenue',
      value: formatMoney(summary.revenue, currency),
      note: revenueNote,
    },
    {
      label: 'Margin',
      value: formatMoney(summary.margin, currency),
      note: 'Revenue − total cost.',
      strong: true,
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">Financials</p>
        <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">Cost, revenue &amp; margin</h2>
      </header>
      <div className="divide-y divide-[var(--color-brand-border)]">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className={cn('text-[13px]', r.strong ? 'font-bold text-[var(--color-brand-fg)]' : 'text-[var(--color-brand-fg-soft)]')}>{r.label}</p>
              <p className="text-[11px] text-[var(--color-brand-muted)]">{r.note}</p>
            </div>
            <p className={cn('shrink-0 tabular-nums', r.strong ? 'text-[15px] font-bold' : 'text-[13.5px]', 'text-[var(--color-brand-fg)]')}>
              {r.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── climate ─────────────────────────── */

function ClimateCard({ climate }: { climate: FlockReportSummary['climate'] | undefined }) {
  // Defensive: old backend deploys served the summary without a
  // `climate` field. Treat missing block as "unavailable" so the
  // page doesn't crash during a mid-deploy window.
  if (!climate || !climate.available) {
    const reason = climate?.available === false
      ? climate.reason
      : 'Climate data is loading — if this persists, the backend needs to be redeployed to include the new climate section.';
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Thermometer className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">Climate report unavailable</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
              {reason}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const confidenceBadge =
    climate.confidence === 'high' ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
    : climate.confidence === 'medium' ? 'bg-amber-50 text-amber-800'
    : 'bg-rose-50 text-rose-700';

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">Climate — PENKEEP</p>
          <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">Zone comfort &amp; air quality</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider', confidenceBadge)}>
            Confidence: {climate.confidence}
          </span>
          <span className="text-[11px] text-[var(--color-brand-muted)]">
            coverage {formatDecimal(climate.coveragePct, 1)}% ·{' '}
            {formatCount(climate.readingCount)} readings ·{' '}
            {climate.stations} station{climate.stations === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      {/* Zone table */}
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--color-brand-surface-soft)] text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
              <th className="px-4 py-2 sm:px-5">Zone</th>
              <th className="px-4 py-2 text-right sm:px-5">Average temp</th>
              <th className="px-4 py-2 text-right sm:px-5">Hours below min</th>
              <th className="px-4 py-2 text-right sm:px-5">Hours above max</th>
            </tr>
          </thead>
          <tbody>
            {(['left', 'middle', 'right'] as const).map((z) => (
              <tr key={z} className="border-t border-[var(--color-brand-border)]">
                <td className="px-4 py-2 font-semibold text-[var(--color-brand-fg)] sm:px-5">
                  {z.charAt(0).toUpperCase() + z.slice(1)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {climate.zoneAverages[z] !== null ? `${climate.zoneAverages[z]!.toFixed(1)} °C` : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {climate.zoneBreachHours[z].low == null
                    ? '—'
                    : climate.zoneBreachHours[z].low > 0
                      ? <span className="font-bold text-amber-800">{climate.zoneBreachHours[z].low} h</span>
                      : '0 h'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {climate.zoneBreachHours[z].high == null
                    ? '—'
                    : climate.zoneBreachHours[z].high > 0
                      ? <span className="font-bold text-rose-700">{climate.zoneBreachHours[z].high} h</span>
                      : '0 h'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Air quality + humidity chips */}
      <div className="grid gap-3 border-t border-[var(--color-brand-border)] p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        <AqChip icon={Wind} label="NH₃ breach"
          value={climate.airQualityBreachHours.nh3 == null ? '—' : `${climate.airQualityBreachHours.nh3} h`}
          sub={`> ${climate.thresholds.nh3PpmMax} ppm`}
          tone={climate.airQualityBreachHours.nh3 == null ? 'mint' : climate.airQualityBreachHours.nh3 > 0 ? 'rose' : 'mint'} />
        <AqChip icon={Wind} label="CO₂ breach"
          value={climate.airQualityBreachHours.co2 == null ? '—' : `${climate.airQualityBreachHours.co2} h`}
          sub={`> ${climate.thresholds.co2PpmMax} ppm`}
          tone={climate.airQualityBreachHours.co2 == null ? 'mint' : climate.airQualityBreachHours.co2 > 0 ? 'rose' : 'mint'} />
        <AqChip icon={Droplet} label="Humidity (avg)"
          value={climate.humidityAverage !== null ? `${climate.humidityAverage.toFixed(0)}%` : '—'}
          sub={`target ${climate.thresholds.humidityPctMin}–${climate.thresholds.humidityPctMax}%`} tone="sky" />
        <AqChip icon={Droplet} label="Humidity breach"
          value={
            climate.humidityBreachHours.low == null || climate.humidityBreachHours.high == null
              ? '—'
              : `${climate.humidityBreachHours.low + climate.humidityBreachHours.high} h`
          }
          sub={
            climate.humidityBreachHours.low == null || climate.humidityBreachHours.high == null
              ? 'Coverage too low to report'
              : `${climate.humidityBreachHours.low}h low · ${climate.humidityBreachHours.high}h high`
          }
          tone={
            climate.humidityBreachHours.low == null || climate.humidityBreachHours.high == null
              ? 'mint'
              : climate.humidityBreachHours.low + climate.humidityBreachHours.high > 0 ? 'amber' : 'mint'
          } />
      </div>

      {/* Temperature vs breed / age comfort curve. Only rendered when
          the backend attached the advisory block; older backend deploys
          without the feature just skip this section. */}
      {climate.temperatureAdvisory?.available === true && (
        <TemperatureAdvisoryBlock advisory={climate.temperatureAdvisory} />
      )}
      {climate.temperatureAdvisory?.available === false && (
        <div className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/60 p-4 sm:p-5">
          <p className="text-[11.5px] leading-relaxed text-[var(--color-brand-muted)]">
            <strong className="text-[var(--color-brand-fg)]">Temperature vs breed target:</strong>{' '}
            {climate.temperatureAdvisory.reason}
          </p>
        </div>
      )}

      {/* Honest note */}
      <div className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/60 p-4 sm:p-5">
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[var(--color-brand-muted)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" />
          <span>
            {climate.thresholds.note}{' '}
            Breach hours = readings out of range ÷ readings-per-hour (sample every {climate.sampleIntervalSeconds}s).
            Coverage % = actual readings ÷ expected at the sample cadence — a lower number means the device was offline for stretches during the cycle.
          </span>
        </p>
      </div>
    </section>
  );
}

/**
 * Temperature-vs-breed advisory inside the climate section. Reads the
 * per-day series and a cycle-wide verdict + recommendation the backend
 * built via TemperatureBenchmarkResolver, so the on-screen report and
 * the PDF speak with the same voice.
 */
function TemperatureAdvisoryBlock({
  advisory,
}: {
  advisory: Extract<
    NonNullable<
      Extract<FlockReportSummary['climate'], { available: true }>['temperatureAdvisory']
    >,
    { available: true }
  >;
}) {
  const verdictClass =
    advisory.verdict === 'poor' ? 'bg-rose-50 text-rose-700'
    : advisory.verdict === 'fair' ? 'bg-amber-50 text-amber-800'
    : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';

  const day = (n: number | undefined) => n ?? 0;
  const totalDays = day(advisory.dayCounts.excellent) + day(advisory.dayCounts.good) + day(advisory.dayCounts.fair) + day(advisory.dayCounts.poor);

  return (
    <div className="border-t border-[var(--color-brand-border)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
            Temperature vs breed / age comfort curve
          </p>
          <h3 className="mt-0.5 text-[13px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {advisory.verdictLabel}
          </h3>
          {advisory.cycleAvgC !== null && (
            <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
              Cycle-average pen temperature: {advisory.cycleAvgC.toFixed(1)} °C over {totalDays} day{totalDays === 1 ? '' : 's'}.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider', verdictClass)}>
            Verdict: {advisory.verdict}
          </span>
          {advisory.tentative === true && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
              Tentative · {Math.round(advisory.coveragePct ?? 0)}% coverage
            </span>
          )}
        </div>
      </div>

      {advisory.tentative === true && (
        <div className="mt-2 rounded-lg bg-amber-50/60 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
          Coverage was thin this cycle. The verdict may shift as more readings come in — treat this as guidance, not a final grade.
        </div>
      )}

      {/* Day-count histogram — one row per rating bucket. Only renders
          rows whose count > 0 so the block stays compact. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DayCountChip label="Excellent" count={advisory.dayCounts.excellent ?? 0} tone="mint" />
        <DayCountChip label="Good"      count={advisory.dayCounts.good ?? 0}      tone="mint" />
        <DayCountChip label="Fair"      count={advisory.dayCounts.fair ?? 0}      tone="amber" />
        <DayCountChip label="Poor"      count={advisory.dayCounts.poor ?? 0}      tone="rose" />
      </div>

      {advisory.recommendation && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5 px-3 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" />
          <p className="text-[12px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            <strong className="text-[var(--color-brand-fg)]">Recommendation.</strong> {advisory.recommendation}
          </p>
        </div>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--color-brand-muted)]">
        Each day is rated against the physiological target for the flock&rsquo;s age <em>on that day</em> — day 3 is graded on the 32–34 °C brooding target; day 30 on the 20–23 °C growing target. The verdict shows the worst-day rating, not the average, because a single bad day of welfare-level stress matters more than an otherwise-green trend.
      </p>
    </div>
  );
}

function DayCountChip({
  label, count, tone,
}: {
  label: string;
  count: number;
  tone: 'mint' | 'amber' | 'rose';
}) {
  const bg = tone === 'rose' ? 'bg-rose-50 border-rose-200'
    : tone === 'amber' ? 'bg-amber-50 border-amber-200'
    : 'bg-[var(--color-brand-accent)]/40 border-[var(--color-brand-primary)]/30';
  const dim = count === 0 ? 'opacity-40' : '';
  return (
    <div className={cn('rounded-lg border px-3 py-2', bg, dim)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[var(--color-brand-fg)]">{count}</p>
      <p className="text-[10px] text-[var(--color-brand-muted)]">day{count === 1 ? '' : 's'}</p>
    </div>
  );
}

function AqChip({
  icon: Icon, label, value, sub, tone,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
  sub: string;
  tone: 'mint' | 'amber' | 'rose' | 'sky';
}) {
  const bg = tone === 'rose' ? 'bg-rose-50 border-rose-200'
    : tone === 'amber' ? 'bg-amber-50 border-amber-200'
    : tone === 'sky' ? 'bg-sky-50 border-sky-200'
    : 'bg-[var(--color-brand-accent)]/40 border-[var(--color-brand-primary)]/30';
  const iconBg = tone === 'rose' ? 'bg-rose-100 text-rose-700'
    : tone === 'amber' ? 'bg-amber-100 text-amber-800'
    : tone === 'sky' ? 'bg-sky-100 text-sky-800'
    : 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary-deep)]';

  return (
    <div className={cn('rounded-xl border p-3', bg)}>
      <div className="flex items-center gap-2">
        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', iconBg)}>
          <Icon className="h-3 w-3" strokeWidth={2.2} />
        </span>
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">{label}</p>
      </div>
      <p className="mt-1.5 text-[16px] font-bold tabular-nums text-[var(--color-brand-fg)]">{value}</p>
      <p className="text-[10.5px] text-[var(--color-brand-muted)]">{sub}</p>
    </div>
  );
}

/* ─────────────────────────── breakdown ─────────────────────────── */

function BreakdownCard({
  breakdown, currency,
}: { breakdown: FlockReportSummary['breakdown']; currency: string }) {
  if (breakdown.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-5">
        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">No daily records yet</p>
        <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
          Once you start logging feed, water, vaccines and other events for this cycle, they&rsquo;ll roll up here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">Daily records</p>
        <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">By event type</h2>
      </header>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--color-brand-surface-soft)] text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
              <th className="px-4 py-2 sm:px-5">Event</th>
              <th className="px-4 py-2 text-right sm:px-5">Events</th>
              <th className="px-4 py-2 text-right sm:px-5">Corrections</th>
              <th className="px-4 py-2 text-right sm:px-5">Total qty</th>
              <th className="px-4 py-2 text-right sm:px-5">Total spent</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r) => (
              <tr key={r.eventType} className="border-t border-[var(--color-brand-border)]">
                <td className="px-4 py-2 font-semibold text-[var(--color-brand-fg)] sm:px-5">
                  {prettyEventType(r.eventType)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">{formatCount(r.events)}</td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {(r.corrections ?? 0) > 0
                    ? <span className="font-bold text-amber-800">{formatCount(r.corrections!)}</span>
                    : '0'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {r.totalQuantity > 0 ? formatDecimal(r.totalQuantity, 2) : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {r.totalAmount > 0 ? formatMoney(r.totalAmount, currency) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─────────────────────────── vaccination / treatment logs ─────────────────────────── */

/**
 * Per-vaccine log — one row per administration. Silent when the cycle
 * has none; when populated it gives a bank / co-op reader the specific
 * schedule adherence signal they usually ask for verbally.
 */
function VaccinationLog({
  rows, currency,
}: { rows: FlockReportDetailedEntry[]; currency: string }) {
  if (rows.length === 0) return null;

  return (
    <DetailedEntryTable
      eyebrow="Vaccination log"
      title="Every vaccine administered"
      description="Ordered by date. Insurance, banks and hatchery contracts routinely ask for this exact list."
      rows={rows}
      currency={currency}
      showBirdsColumn={false}
      itemColumnLabel="Vaccine"
    />
  );
}

/**
 * Per-treatment log — antibiotics, coccidiostats, supplements. Adds a
 * "birds" column so a treatment given to a subset of the flock reads
 * honestly.
 */
function TreatmentLog({
  rows, currency,
}: { rows: FlockReportDetailedEntry[]; currency: string }) {
  if (rows.length === 0) return null;

  return (
    <DetailedEntryTable
      eyebrow="Treatment log"
      title="Every treatment given"
      description="Antibiotics, coccidiostats, supplements — evidence of health events and how they were handled."
      rows={rows}
      currency={currency}
      showBirdsColumn={true}
      itemColumnLabel="Treatment"
    />
  );
}

function DetailedEntryTable({
  eyebrow, title, description, rows, currency, showBirdsColumn, itemColumnLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows: FlockReportDetailedEntry[];
  currency: string;
  showBirdsColumn: boolean;
  itemColumnLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">{eyebrow}</p>
        <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">{title}</h2>
        <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">{description}</p>
      </header>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--color-brand-surface-soft)] text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
              <th className="px-4 py-2 sm:px-5">Date</th>
              <th className="px-4 py-2 sm:px-5">{itemColumnLabel}</th>
              <th className="px-4 py-2 sm:px-5">Brand</th>
              <th className="px-4 py-2 text-right sm:px-5">Dose</th>
              {showBirdsColumn && <th className="px-4 py-2 text-right sm:px-5">Birds</th>}
              <th className="px-4 py-2 text-right sm:px-5">Cost</th>
              <th className="px-4 py-2 sm:px-5">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-brand-border)]">
                <td className="px-4 py-2 whitespace-nowrap text-[var(--color-brand-fg-soft)] sm:px-5">
                  {r.recordDate ?? '—'}
                </td>
                <td className="px-4 py-2 font-semibold text-[var(--color-brand-fg)] sm:px-5">
                  {r.itemType ?? '—'}
                </td>
                <td className="px-4 py-2 text-[var(--color-brand-fg-soft)] sm:px-5">
                  {r.itemBrand ?? '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {r.quantity != null && r.quantity > 0
                    ? `${formatDecimal(r.quantity, 2)}${r.unit ? ' ' + r.unit : ''}`
                    : '—'}
                </td>
                {showBirdsColumn && (
                  <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                    {r.birdsDelta != null && r.birdsDelta > 0
                      ? formatCount(r.birdsDelta)
                      : '—'}
                  </td>
                )}
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                  {r.amount != null && r.amount > 0
                    ? formatMoney(r.amount, currency)
                    : '—'}
                </td>
                <td className="px-4 py-2 text-[var(--color-brand-fg-soft)] sm:px-5">
                  {r.note ? <span className="line-clamp-2">{r.note}</span> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─────────────────────────── recommendations ─────────────────────────── */

/**
 * Punch list at the bottom of the report. Ranked by severity. Each entry
 * is a specific "what to do" so the farmer leaves the page with a
 * concrete next action instead of just a bag of numbers.
 */
function RecommendationsBlock({
  recommendations,
}: {
  recommendations: NonNullable<FlockReportSummary['recommendations']>;
}) {
  if (recommendations.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/25 p-4 sm:p-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">Recommendations</p>
        <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">Nothing pressing to change</h2>
        <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
          Every metric we track is inside its healthy band for this cycle&rsquo;s current phase. Keep logging daily records and we&rsquo;ll flag any change here as soon as it shows up.
        </p>
      </section>
    );
  }

  const sorted = [...recommendations].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
  });

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">Recommendations</p>
        <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          {sorted.length} item{sorted.length === 1 ? '' : 's'} to act on
        </h2>
        <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
          Items tagged <em>current cycle</em> are still actionable right now. Items tagged <em>next cycle</em> are lessons for the next placement.
        </p>
      </header>
      <ul className="divide-y divide-[var(--color-brand-border)]">
        {sorted.map((r, i) => (
          <li key={`${r.topic}-${i}`} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:gap-4 sm:px-5">
            <div className="flex shrink-0 flex-wrap items-start gap-1.5 sm:w-40 sm:flex-col">
              <SeverityBadge severity={r.severity} />
              <TimingBadge timing={r.timing} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{r.headline}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-brand-fg-soft)]">{r.action}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const cls = severity === 'high' ? 'bg-rose-50 text-rose-700'
    : severity === 'medium' ? 'bg-amber-50 text-amber-800'
    : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', cls)}>
      {severity}
    </span>
  );
}

function TimingBadge({ timing }: { timing: 'current_cycle' | 'next_cycle' }) {
  const label = timing === 'current_cycle' ? 'Current cycle' : 'Next cycle';
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-brand-surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand-muted)]">
      {label}
    </span>
  );
}

/* ─────────────────────────── exports ─────────────────────────── */

function ExportsRow({ flockId }: { flockId: string }) {
  const csv = useMutation({
    mutationFn: () => endpoints.downloadFlockRecordsCsv(flockId),
    onSuccess: (blob) => triggerBlobDownload(blob, `flock-${flockId.slice(0, 8)}-records-${today()}.csv`),
    onError: async (err) => toast.error(await extractBlobError(err, 'Could not export CSV.')),
  });
  const pdf = useMutation({
    mutationFn: () => endpoints.downloadFlockReportPdf(flockId),
    onSuccess: (blob) => triggerBlobDownload(blob, `flock-${flockId.slice(0, 8)}-report-${today()}.pdf`),
    onError: async (err) => toast.error(await extractBlobError(err, 'Could not export PDF.')),
  });

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-primary)]/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">Share with your bank or co-op</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
            The PDF is a printable one-page cycle summary — signable, shareable, honest about coverage.
            The CSV is every raw daily-record row for your own spreadsheets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => csv.mutate()} disabled={csv.isPending}>
            {csv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Records CSV
          </Button>
          <Button size="sm" onClick={() => pdf.mutate()} disabled={pdf.isPending}>
            {pdf.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Cycle report PDF
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── notes / disclaimers ─────────────────────────── */

function AccuracyNotes() {
  return (
    <details className="rounded-xl border border-[var(--color-brand-border)] bg-white px-4 py-3 text-[11.5px] leading-relaxed text-[var(--color-brand-muted)] sm:px-5">
      <summary className="cursor-pointer text-[12px] font-bold text-[var(--color-brand-fg)]">
        How these numbers are computed
      </summary>
      <ul className="mt-3 space-y-1.5">
        <li>
          <strong className="text-[var(--color-brand-fg)]">Birds now</strong> uses the latest &ldquo;bird count&rdquo; snapshot you logged. If none was logged, it falls back to placed − mortality entries − sale entries.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">Mortality</strong> prefers explicit mortality entries. If none exist, it&rsquo;s inferred from the drop between placed birds and the latest bird-count snapshot. The KPI card tells you which mode was used.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">Feed (kg)</strong> normalises logged units: bag → 25 kg, sack → 50 kg, tonne → 1,000 kg, gram → 0.001 kg. Unknown units are treated as kg.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">FCR</strong> uses (latest average bird weight − earliest average bird weight) × current birds, and only prints when that gain is positive AND the resulting ratio is inside a sane 0.5–10 window. Otherwise the field says &ldquo;insufficient data&rdquo; — never a misleading number driven by a unit-entry mistake.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">Placement cost</strong> is the flock&rsquo;s original purchase price. It&rsquo;s kept separate from operating expenses so P&amp;L stays honest.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">Climate breach hours</strong> come from the PENKEEP&rsquo;s own status flags against the min / max you set on the device. Air-quality thresholds (NH₃ &gt; 25 ppm, CO₂ &gt; 5,000 ppm) follow broiler welfare guidance.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">Coverage %</strong> tells you how full the PENKEEP stream was. Below 90% means the device was offline for stretches — the numbers stay honest but weigh them accordingly.
        </li>
        <li>
          <strong className="text-[var(--color-brand-fg)]">Corrections</strong> are append-only reversal entries — a farmer can post one at any time on an entry they created, with a required reason. The original stays in the ledger next to the offsetting fix, and all aggregations above use the NET (original + correction). The Records CSV export shows every original + correction pair with the reason so the audit story is intact end-to-end.
        </li>
      </ul>
    </details>
  );
}

/* ─────────────────────────── states ─────────────────────────── */

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Bird className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[14px] font-bold text-[var(--color-brand-fg)]">No cycles to report on yet</p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
        Place a flock and log some daily records — you&rsquo;ll be able to export a full cycle report once there&rsquo;s data.
      </p>
      <Button asChild size="sm" className="mt-5">
        <Link href="/setup/flocks">
          Place a flock <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
      <p className="text-[13px] font-bold text-rose-900">Couldn&rsquo;t load this cycle report</p>
      <p className="mt-1 text-[12px] text-rose-900">{apiErrorMessage(error, 'Please retry — if this keeps happening, contact support.')}</p>
    </div>
  );
}

/* ─────────────────────────── formatting + helpers ─────────────────────────── */

/**
 * Turn a raw event_type slug into a farmer-facing label — snake_case
 * looks industrial in a report the reader is expected to trust.
 */
function prettyEventType(slug: string): string {
  const map: Record<string, string> = {
    feed: 'Feed',
    water: 'Water',
    weight: 'Weight',
    eggs: 'Eggs',
    mortality: 'Mortality',
    sale: 'Sale',
    vaccination: 'Vaccination',
    treatment: 'Treatment',
    bird_count: 'Bird count',
    note: 'Note',
  };
  if (map[slug]) return map[slug];
  // Fallback for unknown slugs — replace underscores with spaces and
  // uppercase the first letter, so a future event_type doesn't render
  // as "some_new_thing" in the report.
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

function formatDecimal(n: number | null | undefined, places = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(places);
}

function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(2)}%`;
}

function formatMoney(n: number | null | undefined, currency: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  // Deliberately show the currency code rather than a locale-formatted
  // symbol so the reader always knows which currency they're looking at.
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * When responseType is 'blob', an error response arrives as a Blob and
 * apiErrorMessage can't read it. Decode it here so the toast shows the
 * real server message instead of the generic fallback.
 */
async function extractBlobError(err: unknown, fallback: string): Promise<string> {
  if (err instanceof AxiosError && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      try {
        const json = JSON.parse(text) as { message?: string };
        if (json.message) return json.message;
      } catch {
        if (text) return text.slice(0, 200);
      }
    } catch { /* blob unreadable */ }
  }
  return apiErrorMessage(err, fallback);
}
