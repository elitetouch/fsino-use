'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Filter, Loader2, Thermometer, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { endpoints, type FlockClimateReadingRow, type PenClimateStation } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Pen climate — history table.
 *
 * Sister view to <PenClimate>. Same data, transposed: instead of "one
 * live snapshot", the farmer sees a chronological log of every reading
 * the pen recorded during THIS flock's cycle. The backend scopes the
 * window to the flock's own placement → archived range so a stray
 * reading from the previous cycle never leaks in.
 *
 * Filters kept intentionally minimal — date range (defaulting to the
 * whole cycle), one station picker (only when the pen has more than
 * one PENKEEP), and an "over-threshold only" toggle for quick triage.
 *
 * Export is a direct link to the backend's CSV stream. No blob dance
 * in JS — the browser handles the download, so a multi-week cycle
 * doesn't sit in memory before it can be saved.
 */
export function PenClimateHistory({
  flockId, stations,
}: {
  flockId: string;
  /** Same stations array the live view uses, for the picker label. */
  stations: PenClimateStation[];
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'over'>('all');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const query = useQuery({
    queryKey: ['flock-climate-readings', flockId, { from, to, deviceId, statusFilter, page, perPage }],
    queryFn: () => endpoints.listFlockClimateReadings(flockId, {
      from: from || undefined,
      to: to || undefined,
      device_id: deviceId || undefined,
      status: statusFilter,
      page,
      per_page: perPage,
    }),
    enabled: !!flockId,
    // Keep readings on the page while the farmer refetches — no
    // skeleton flash while paginating.
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.rows ?? [];
  const meta = query.data?.meta;
  const window = query.data?.window;

  const csvHref = useMemo(() => {
    const base = endpoints.flockClimateReadingsCsvUrl(flockId);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (deviceId) params.set('device_id', deviceId);
    if (statusFilter === 'over') params.set('status', 'over');
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [flockId, from, to, deviceId, statusFilter]);

  const multiStation = stations.length > 1;

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden">
      {/* Filter bar */}
      <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[12.5px] focus:border-[var(--color-brand-primary)] focus:outline-none"
            />
          </FilterField>
          <FilterField label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[12.5px] focus:border-[var(--color-brand-primary)] focus:outline-none"
            />
          </FilterField>

          {multiStation && (
            <FilterField label="Station">
              <select
                value={deviceId}
                onChange={(e) => { setDeviceId(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[12.5px] focus:border-[var(--color-brand-primary)] focus:outline-none"
              >
                <option value="">All stations</option>
                {stations.map((s) => (
                  <option key={s.device.deviceId} value={s.device.deviceId}>
                    {s.stationLabel ?? s.device.deviceId}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          <FilterField label="Show">
            <div className="inline-flex rounded-md border border-[var(--color-brand-input-border)] bg-white p-0.5 text-[11.5px] font-semibold">
              {(['all', 'over'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setStatusFilter(f); setPage(1); }}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 transition-colors',
                    statusFilter === f
                      ? 'bg-[var(--color-brand-primary)] text-white'
                      : 'text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]',
                  )}
                >
                  {f === 'all' ? 'All' : 'Out-of-range'}
                </button>
              ))}
            </div>
          </FilterField>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <p className="text-[11.5px] text-[var(--color-brand-muted)]">
              {meta ? `${meta.total.toLocaleString()} rows` : '—'}
              {window && (
                <span className="ml-2">
                  · window {fmtDate(window.from)} → {fmtDate(window.to)}
                </span>
              )}
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={csvHref} download>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[880px] table-fixed border-collapse">
            <thead>
              <tr className="bg-[var(--color-brand-surface-soft)] text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
                <Th className="w-40">When</Th>
                {multiStation && <Th className="w-28">Station</Th>}
                <Th className="w-16">Left</Th>
                <Th className="w-16">Mid</Th>
                <Th className="w-16">Right</Th>
                <Th className="w-16">Hum</Th>
                <Th className="w-14">NH₃</Th>
                <Th className="w-16">CO₂</Th>
                <Th className="w-14">AQI</Th>
                <Th className="w-14">Bat</Th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={multiStation ? 10 : 9} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-brand-primary-deep)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={multiStation ? 10 : 9} className="px-4 py-14 text-center">
                    <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <Filter className="h-4.5 w-4.5" />
                    </span>
                    <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">
                      No readings match your filters
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
                      Try widening the date range or switching to &ldquo;All&rdquo;.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => <ReadingRow key={String(r.id)} row={r} multiStation={multiStation} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.lastPage > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--color-brand-border)] px-4 py-3">
            <p className="text-[11.5px] text-[var(--color-brand-muted)]">
              Page {meta.currentPage} of {meta.lastPage}
            </p>
            <div className="inline-flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.lastPage || query.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── row + cell primitives ─────────────────────────── */

function ReadingRow({ row, multiStation }: { row: FlockClimateReadingRow; multiStation: boolean }) {
  const anyOver = row.zones.left.status === 'high' || row.zones.left.status === 'low'
    || row.zones.middle.status === 'high' || row.zones.middle.status === 'low'
    || row.zones.right.status === 'high' || row.zones.right.status === 'low'
    || row.nh3Ppm > 25 || row.co2Ppm > 5000;

  return (
    <tr
      className={cn(
        'border-t border-[var(--color-brand-border)] text-[12px]',
        anyOver ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-[var(--color-brand-surface-soft)]',
      )}
    >
      <Td className="whitespace-nowrap font-mono text-[11.5px] text-[var(--color-brand-fg)]">
        {fmtDateTime(row.readingAt)}
      </Td>
      {multiStation && (
        <Td className="truncate text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)]">
          {row.stationLabel ?? row.deviceId?.slice(-4) ?? '—'}
        </Td>
      )}
      <ZoneCell zone={row.zones.left} />
      <ZoneCell zone={row.zones.middle} />
      <ZoneCell zone={row.zones.right} />
      <Td className="tabular-nums">{row.humidity}%</Td>
      <Td className={cn('tabular-nums', row.nh3Ppm > 25 ? 'font-bold text-rose-700' : row.nh3Ppm > 10 ? 'text-amber-800' : '')}>
        {row.nh3Ppm}
      </Td>
      <Td className={cn('tabular-nums', row.co2Ppm > 5000 ? 'font-bold text-rose-700' : row.co2Ppm > 2500 ? 'text-amber-800' : '')}>
        {row.co2Ppm.toLocaleString()}
      </Td>
      <Td className="tabular-nums">{row.aqi}</Td>
      <Td className={cn('tabular-nums', row.battery.pct < 20 ? 'text-rose-700' : row.battery.pct < 40 ? 'text-amber-800' : '')}>
        {row.battery.pct}%
      </Td>
    </tr>
  );
}

function ZoneCell({ zone }: { zone: FlockClimateReadingRow['zones']['left'] }) {
  const tone = zone.status === 'high' ? 'rose'
    : zone.status === 'low' ? 'amber'
    : 'default';
  return (
    <Td
      className={cn(
        'tabular-nums',
        tone === 'rose' ? 'font-bold text-rose-700'
          : tone === 'amber' ? 'font-bold text-amber-800'
          : 'text-[var(--color-brand-fg)]',
      )}
      title={zone.status === 'high' ? 'Above max' : zone.status === 'low' ? 'Below min' : 'In range'}
    >
      {zone.temp.toFixed(1)}
      {zone.heaterOn && (
        <span aria-label="heater on" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
    </Td>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2', className)}>{children}</th>;
}

function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={cn('px-3 py-2', className)} title={title}>{children}</td>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────── formatting ─────────────────────────── */

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}
