'use client';

import Link from 'next/link';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Droplets,
  Leaf,
  Loader2,
  Plug,
  Sprout,
  ThermometerSun,
  Wind,
} from 'lucide-react';
import { useCurrentFarmId } from '@/lib/farm-context';
import { useVertical } from '@/lib/vertical';
import {
  endpoints,
  type CropCycleDto,
  type PenClimateDto,
} from '@/lib/api';
import {
  assessTemperature,
  assessVpd,
  isDaytime,
  severityRank,
  type BandVerdict,
} from '@/lib/greenhouse';
import { cn } from '@/lib/utils';

/**
 * The greenhouse dashboard.
 *
 * SHAPED FOR ONE QUESTION — "does anything need me right now" — the
 * same way the cold room index is. A grower opens this on their phone
 * between other jobs, not to browse. So bays sort worst first, the
 * verdict is a sentence rather than a number, and the reading that
 * decides the verdict is the biggest thing on the card.
 *
 * WHY THE WARMEST ZONE, NOT THE AVERAGE. A PENKEEP reports three
 * probes. Averaging them hides the thing that matters: if one end of
 * the bay is at 34°C the tomatoes at that end are setting no fruit,
 * and an average of 29°C across the house says everything is fine.
 * Heat damage is local, so the worst probe is the honest one.
 */

const POLL_MS = 60_000;

export default function GreenhouseDashboardPage() {
  const farmId = useCurrentFarmId();
  const { vertical, unit, unitPlural, isLoading: verticalLoading } = useVertical();

  const cycles = useQuery({
    queryKey: ['crop-cycles', farmId],
    queryFn: () => endpoints.listCropCycles(),
    enabled: !!farmId && vertical === 'greenhouse',
    refetchInterval: POLL_MS,
  });

  const list: CropCycleDto[] = cycles.data?.cycles ?? [];

  // One climate query per bay. They are independent, so a bay whose
  // PENKEEP is unreachable does not hold up the rest of the page.
  const climates = useQueries({
    queries: list.map((c) => ({
      queryKey: ['pen-climate', c.bay.id],
      queryFn: () => endpoints.getPenClimate(c.bay.id as string),
      enabled: !!c.bay.id,
      refetchInterval: POLL_MS,
      // 404 means no PENKEEP paired, which is a state to render rather
      // than an error to retry at.
      retry: false,
    })),
  });

  const rows = list.map((cycle, i) => {
    const climate = climates[i]?.data as PenClimateDto | undefined;
    const loading = climates[i]?.isLoading ?? false;

    const reading =
      climate?.stations?.find((s) => s.current !== null)?.current ?? null;

    const temp =
      reading === null
        ? null
        : Math.max(
            reading.zones.left.current,
            reading.zones.middle.current,
            reading.zones.right.current,
          );

    const humidity = reading?.humidity.value ?? null;
    const co2 = reading?.airQuality.co2Ppm ?? null;

    const band: BandVerdict | null =
      temp === null ? null : assessTemperature(temp, cycle);

    const vpd =
      temp === null || humidity === null
        ? null
        : assessVpd(temp, humidity, cycle.crop);

    return { cycle, temp, humidity, co2, band, vpd, loading, hasDevice: !!climate };
  });

  const sorted = [...rows].sort(
    (a, b) => severityRank(a.band?.status ?? null) - severityRank(b.band?.status ?? null),
  );

  const needingAttention = rows.filter(
    (r) => r.band?.status === 'critical' || r.band?.status === 'high',
  ).length;

  if (verticalLoading || cycles.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header>
        <h1
          className="font-extrabold tracking-tight text-[var(--color-brand-fg)]"
          style={{ fontSize: 'var(--text-h1)' }}
        >
          Your greenhouse
        </h1>
        <p
          className="mt-1.5 text-[var(--color-brand-muted)]"
          style={{ fontSize: 'var(--text-lead)' }}
        >
          {list.length === 0
            ? `No crops placed yet.`
            : needingAttention === 0
              ? `${list.length} ${list.length === 1 ? unit.toLowerCase() : unitPlural.toLowerCase()} growing, all within band.`
              : `${needingAttention} of ${list.length} ${unitPlural.toLowerCase()} need you.`}{' '}
          <span className="text-xs">
            ({isDaytime() ? 'day' : 'night'} bands in force)
          </span>
        </p>
      </header>

      {list.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-[var(--color-brand-surface-soft)]/60 p-8 text-center">
          <Sprout className="mx-auto h-8 w-8 text-[var(--color-brand-primary)]" />
          <p className="mt-3 text-sm font-bold text-[var(--color-brand-fg)]">
            Nothing growing yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--color-brand-muted)]">
            Place a crop in a {unit.toLowerCase()} and this page starts
            watching its climate against what that crop actually needs.
          </p>
          <Link
            href="/setup/crops"
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-input)] bg-[var(--color-brand-primary)] px-5 text-sm font-bold text-white"
          >
            Place a crop <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {sorted.map((row) => (
          <BayCard key={row.cycle.id} row={row} unit={unit} />
        ))}
      </div>
    </div>
  );
}

type Row = {
  cycle: CropCycleDto;
  temp: number | null;
  humidity: number | null;
  co2: number | null;
  band: BandVerdict | null;
  vpd: ReturnType<typeof assessVpd> | null;
  loading: boolean;
  hasDevice: boolean;
};

/**
 * Semantic colour, deliberately separate from the brand green.
 *
 * Everything on this page would otherwise be green, which is exactly
 * when a grower stops reading it. "In band" is neutral rather than
 * green for the same reason — the page should be quiet when nothing is
 * wrong, and loud only when something is.
 */
const TONE: Record<BandVerdict['status'], { bg: string; fg: string; dot: string }> = {
  critical: { bg: 'bg-[#FEE2E2]', fg: 'text-[#991B1B]', dot: 'bg-[#DC2626]' },
  high: { bg: 'bg-[#FEF3C7]', fg: 'text-[#78350F]', dot: 'bg-[#D97706]' },
  low: { bg: 'bg-[#DBEAFE]', fg: 'text-[#1E3A8A]', dot: 'bg-[#2563EB]' },
  ok: {
    bg: 'bg-[var(--color-brand-surface-soft)]',
    fg: 'text-[var(--color-brand-muted)]',
    dot: 'bg-[var(--color-brand-primary)]',
  },
};

function BayCard({ row, unit }: { row: Row; unit: string }) {
  const { cycle, temp, humidity, co2, band, vpd, loading, hasDevice } = row;
  const tone = band ? TONE[band.status] : null;

  return (
    <article
      className={cn(
        'rounded-2xl border bg-white p-5',
        band?.status === 'critical'
          ? 'border-[#DC2626]'
          : 'border-[var(--color-brand-border)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[var(--color-brand-fg)]">
            {cycle.bay.name ?? `Unassigned ${unit.toLowerCase()}`}
          </h2>
          <p className="mt-0.5 truncate text-xs text-[var(--color-brand-muted)]">
            <Leaf className="mr-1 inline h-3 w-3" />
            {cycle.crop_label}
            {cycle.variety ? ` · ${cycle.variety}` : ''} · {cycle.code}
          </p>
        </div>
        {cycle.days_to_harvest !== null && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tabular-nums text-[var(--color-brand-fg)]">
              {cycle.days_to_harvest < 0
                ? `${Math.abs(cycle.days_to_harvest)}d over`
                : `${cycle.days_to_harvest}d`}
            </p>
            <p className="text-[0.6875rem] text-[var(--color-brand-muted)]">
              {cycle.days_to_harvest < 0 ? 'past window' : 'to harvest'}
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5 flex h-20 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      )}

      {!loading && !hasDevice && (
        <div className="mt-5 rounded-xl bg-[var(--color-brand-surface-soft)] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand-fg)]">
            <Plug className="h-3.5 w-3.5" /> No sensor in this {unit.toLowerCase()}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-brand-muted)]">
            The crop and its band are recorded, but nothing is measuring
            against them yet.
          </p>
          <Link
            href={`/pens/${cycle.bay.id}/pair-device`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-brand-primary-deep)]"
          >
            Pair a PENKEEP <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {!loading && hasDevice && temp !== null && band && tone && (
        <>
          <div className="mt-5 flex items-end gap-4">
            <div>
              <p className="flex items-baseline gap-1 font-extrabold tabular-nums text-[var(--color-brand-fg)]">
                <span style={{ fontSize: '2.25rem', lineHeight: 1 }}>
                  {temp.toFixed(1)}
                </span>
                <span className="text-base">°C</span>
              </p>
              <p className="mt-1 text-[0.6875rem] text-[var(--color-brand-muted)]">
                warmest probe
              </p>
            </div>
            <span
              className={cn(
                'mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                tone.bg,
                tone.fg,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
              {band.headline}
            </span>
          </div>

          {band.status === 'critical' && (
            <p className="mt-3 flex gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2.5 text-xs leading-relaxed text-[#991B1B]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{band.note}</span>
            </p>
          )}

          {band.status !== 'critical' && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-brand-muted)]">
              {band.note}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--color-brand-border)] pt-4">
            <Metric
              icon={<Droplets className="h-3.5 w-3.5" />}
              label="Humidity"
              value={humidity === null ? '—' : `${humidity.toFixed(0)}%`}
            />
            <Metric
              icon={<ThermometerSun className="h-3.5 w-3.5" />}
              label="VPD"
              value={
                vpd === null || vpd.level === 'not_applicable'
                  ? '—'
                  : `${vpd.kpa.toFixed(2)} kPa`
              }
              tone={
                vpd?.level === 'too_dry' || vpd?.level === 'too_humid'
                  ? 'warn'
                  : undefined
              }
            />
            <Metric
              icon={<Wind className="h-3.5 w-3.5" />}
              label="CO₂"
              value={co2 === null ? '—' : `${co2.toFixed(0)} ppm`}
            />
          </dl>

          {vpd && vpd.level !== 'good' && (
            <p className="mt-2.5 text-xs leading-relaxed text-[var(--color-brand-muted)]">
              <strong className="font-bold text-[var(--color-brand-fg)]">
                {vpd.label}:
              </strong>{' '}
              {vpd.note}
            </p>
          )}
        </>
      )}

      {!loading && hasDevice && temp === null && (
        <p className="mt-5 rounded-xl bg-[var(--color-brand-surface-soft)] px-4 py-3 text-xs text-[var(--color-brand-muted)]">
          A PENKEEP is paired but has not sent a reading yet.
        </p>
      )}
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[0.6875rem] text-[var(--color-brand-muted)]">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums',
          tone === 'warn' ? 'text-[#B45309]' : 'text-[var(--color-brand-fg)]',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
