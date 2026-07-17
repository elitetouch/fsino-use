'use client';

/**
 * Analytical cards — derived views over the raw event data.
 *
 * Neither card fabricates numbers. When the backend can't compute
 * something (no growth, no target, no peer cycles) it says so
 * explicitly instead of showing a zero or a plausible-looking guess.
 */

import { CalendarClock, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type {
  HarvestForecastCardDto,
  PeerBenchmarkCardDto,
  PeerComparisonDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/* ─────────────────── Harvest forecast (broilers only) ───────────────── */

export function HarvestForecastCard({ data }: { data?: HarvestForecastCardDto | null }) {
  if (!data || !data.summary) return null;
  const s = data.summary;

  // The "when" line — every branch reads the actual status, we never
  // fall through to "coming soon" text without a value to back it.
  const when = (() => {
    switch (s.status) {
      case 'ready':
        return { headline: 'Ready to harvest', tone: 'good' as const };
      case 'projected':
        return {
          headline: s.projectedMarketAgeDays !== null
            ? `~${s.daysRemaining} day${s.daysRemaining === 1 ? '' : 's'} to market`
            : 'Projected',
          tone: 'neutral' as const,
        };
      case 'no_growth':
        return { headline: 'Growth stalled', tone: 'bad' as const };
      case 'insufficient_history':
        return { headline: 'Need another weigh-in', tone: 'neutral' as const };
      case 'no_weight':
        return { headline: 'No weigh-ins yet', tone: 'neutral' as const };
      case 'no_target':
        return { headline: 'No breed target', tone: 'neutral' as const };
      case 'beyond_horizon':
        return { headline: 'Growth too slow to project', tone: 'bad' as const };
      default:
        return { headline: '—', tone: 'neutral' as const };
    }
  })();

  const toneClass =
    when.tone === 'good' ? 'bg-emerald-100 text-emerald-800'
      : when.tone === 'bad' ? 'bg-rose-100 text-rose-800'
        : 'bg-[var(--color-brand-fg)] text-white';

  return (
    <article className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">
            Harvest forecast
          </p>
        </div>
        <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold', toneClass)}>
          {when.headline}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        {s.note || 'Not enough data to project a harvest day yet.'}
      </p>

      {(s.growthRateGPerDay !== null || s.currentWeightG !== null || s.targetWeightG !== null) && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <ForecastStat
            label="Now"
            value={s.currentWeightG !== null ? `${(s.currentWeightG / 1000).toFixed(2)} kg` : '—'}
          />
          <ForecastStat
            label="Target"
            value={s.targetWeightG !== null ? `${(s.targetWeightG / 1000).toFixed(2)} kg` : '—'}
          />
          <ForecastStat
            label="Rate"
            value={s.growthRateGPerDay !== null ? `${s.growthRateGPerDay.toFixed(0)} g/day` : '—'}
          />
        </div>
      )}

      {s.projectedMarketAgeDays !== null && s.breedMarketAgeDays !== null && (
        <p className="mt-3 text-[11px] text-[var(--color-brand-muted)]">
          Projected day {s.projectedMarketAgeDays} · breed standard day {s.breedMarketAgeDays}
        </p>
      )}
    </article>
  );
}

function ForecastStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--color-brand-surface-soft)]/60 px-2 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">{label}</p>
      <p className="mt-0.5 text-[12px] font-bold text-[var(--color-brand-fg)]">{value}</p>
    </div>
  );
}

/* ──────────────────────── Peer benchmarking ─────────────────────────── */

export function PeerBenchmarkCard({ data }: { data?: PeerBenchmarkCardDto | null }) {
  if (!data || !data.summary || data.summary.sampleSize === 0) return null;
  const s = data.summary;

  return (
    <article className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Users className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">
            Vs your past cycles
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-[var(--color-brand-fg)] px-2 py-0.5 text-[11px] font-bold text-white">
          {s.sampleSize} peer{s.sampleSize === 1 ? '' : 's'}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-brand-fg-soft)]">
        Comparing at bird age <strong className="font-bold text-[var(--color-brand-fg)]">day {s.birdAge}</strong> against the median of your last {s.sampleSize} completed cycle{s.sampleSize === 1 ? '' : 's'} of the same breed on this farm.
      </p>

      <div className="mt-3 space-y-2">
        <ComparisonRow
          label="FCR"
          current={s.current?.fcr}
          median={s.peerMedian?.fcr}
          comparison={s.comparisons?.fcr}
          format={(v) => v.toFixed(2)}
          peerCount={s.peerMedian?.fcrPeers}
        />
        <ComparisonRow
          label="Bird weight"
          current={s.current?.avgWeightG != null ? s.current.avgWeightG / 1000 : null}
          median={s.peerMedian?.avgWeightG != null ? s.peerMedian.avgWeightG / 1000 : null}
          comparison={s.comparisons?.weight}
          format={(v) => `${v.toFixed(2)} kg`}
          peerCount={s.peerMedian?.weightPeers}
        />
        <ComparisonRow
          label="Mortality"
          current={s.current?.mortalityPct}
          median={s.peerMedian?.mortalityPct}
          comparison={s.comparisons?.mortality}
          format={(v) => `${v.toFixed(1)}%`}
          peerCount={s.peerMedian?.mortalityPeers}
        />
      </div>

      {data.insights.length > 0 && (
        <p className="mt-3 text-[11px] leading-snug text-[var(--color-brand-muted)]">
          {data.insights[0]}
        </p>
      )}
    </article>
  );
}

function ComparisonRow({
  label,
  current,
  median,
  comparison,
  format,
  peerCount,
}: {
  label: string;
  current: number | null | undefined;
  median: number | null | undefined;
  comparison: PeerComparisonDto | null | undefined;
  format: (v: number) => string;
  peerCount: number | undefined;
}) {
  const Icon = comparison?.status === 'better' ? TrendingUp
    : comparison?.status === 'worse' ? TrendingDown
      : Minus;
  const iconClass = comparison?.status === 'better' ? 'text-emerald-700'
    : comparison?.status === 'worse' ? 'text-rose-700'
      : 'text-[var(--color-brand-muted)]';

  const empty = current == null || median == null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-[var(--color-brand-surface-soft)]/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
          {label}
        </p>
        {empty ? (
          <p className="mt-0.5 text-[11px] text-[var(--color-brand-muted)]">
            {current == null ? 'Not enough current data' : `No peer readings at day ${peerCount ?? 0}`}
          </p>
        ) : (
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-fg)]">
            You <strong className="font-bold">{format(current!)}</strong> · median {format(median!)} <span className="text-[var(--color-brand-muted)]">({peerCount ?? 0} peer{peerCount === 1 ? '' : 's'})</span>
          </p>
        )}
      </div>
      {!empty && comparison && (
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold', iconClass)}>
          <Icon className="h-3 w-3" strokeWidth={2.5} />
          {comparison.deltaPct > 0 ? '+' : ''}{comparison.deltaPct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
