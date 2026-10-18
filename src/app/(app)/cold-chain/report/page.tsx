'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Package, Printer } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { endpoints } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { mins, money } from '@/lib/cold-chain-format';

/**
 * The facility breach report — every excursion across every room in a
 * window, with the stock that was sitting in it.
 *
 * This is the operator's own record, for an auditor, an insurer or
 * NAFDAC, as opposed to the per-batch report a buyer asks for. Same
 * evidence, different question, so it is a different screen rather
 * than a filter on one.
 *
 * Printable, because the people who ask for it still ask on paper.
 */
export default function ColdChainReportPage() {
  const farmId = useCurrentFarmId();
  const [days, setDays] = useState(30);

  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const report = useQuery({
    queryKey: ['cold-report', farmId, days],
    queryFn: () => endpoints.coldChainReport({ from }),
    enabled: !!farmId,
  });

  const data = report.data;
  const clean = (data?.summary.excursions ?? 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cold chain"
        title="Breach report"
        description="Every excursion on this facility, and the stock that was inside at the time."
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--color-brand-border)] px-3 text-[12.5px] font-semibold hover:bg-[var(--color-brand-surface-soft)] print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        }
      />

      <div className="flex gap-2 print:hidden">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold',
              days === d
                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white'
                : 'border-[var(--color-brand-border)] bg-white hover:bg-[var(--color-brand-surface-soft)]',
            )}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {report.isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--color-brand-surface-soft)]" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Excursions" value={String(data.summary.excursions)} />
            <Stat
              label="Critical"
              value={String(data.summary.critical)}
              tone={data.summary.critical > 0 ? 'bad' : undefined}
            />
            <Stat label="Time out of band" value={mins(data.summary.total_minutes)} />
            <Stat label="Batches affected" value={String(data.summary.batches_affected)} />
          </div>

          {clean ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-[15px] font-bold text-emerald-900">
                  No excursions in this period.
                </p>
                <p className="mt-1 text-[13px] text-emerald-800">
                  Every room held its band for the whole window. This page is the record of that.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.excursions.map((e) => (
                <article
                  key={e.id}
                  className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[14px] font-bold">
                      {e.room}
                      <span className="ml-2 font-normal text-[var(--color-brand-muted)]">
                        {e.peak_temp_c !== null ? `${e.peak_temp_c}°C` : ''}
                      </span>
                    </p>
                    <p className="text-[12.5px] font-semibold tabular-nums">
                      {e.minutes !== null ? mins(e.minutes) : '—'}
                      {e.ongoing && (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-800">
                          ongoing
                        </span>
                      )}
                    </p>
                  </div>

                  <p className="mt-1 text-[13px] text-[var(--color-brand-fg-soft)]">{e.headline}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
                    {e.started_at ? new Date(e.started_at).toLocaleString() : '—'}
                    {e.acknowledged_at
                      ? ` · acknowledged ${new Date(e.acknowledged_at).toLocaleString()}`
                      : ' · not acknowledged'}
                  </p>

                  {e.stock_affected.length > 0 && (
                    <div className="mt-3 border-t border-[var(--color-brand-border)] pt-3">
                      <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]">
                        <Package className="h-3.5 w-3.5" />
                        Stock exposed
                        {e.value_at_risk !== null && (
                          <span className="ml-1 text-rose-700">
                            {money(e.value_at_risk, 'NGN')} at risk
                          </span>
                        )}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {e.stock_affected.map((s) => (
                          <li key={s.batch_id} className="text-[12.5px]">
                            {s.batch_code ? `${s.batch_code} — ` : ''}
                            {s.label}
                            <span className="text-[var(--color-brand-muted)]">
                              {s.minutes !== null ? ` · ${mins(s.minutes)}` : ''}
                              {s.peak_temp_c !== null ? ` · peak ${s.peak_temp_c}°C` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4',
        tone === 'bad' ? 'border-rose-300' : 'border-[var(--color-brand-border)]',
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[22px] font-bold tabular-nums',
          tone === 'bad' && 'text-rose-700',
        )}
      >
        {value}
      </p>
    </div>
  );
}
