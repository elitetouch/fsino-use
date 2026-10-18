'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Printer, ThermometerSun } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { endpoints } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { mins, money } from '@/lib/cold-chain-format';

/**
 * One consignment's exposure history — the document this vertical is
 * actually sold on.
 *
 * A buyer asks for this before accepting delivery, and an insurer asks
 * for it after a claim. It is the one thing a plain temperature log
 * cannot produce, because a log is a fact about a building and this is
 * a fact about the goods in the lorry.
 *
 * "No recorded excursion" is stated as plainly as a breach would be.
 * Most of the time that IS the answer, and burying it in an empty list
 * makes a clean record look like missing data.
 */
export default function BatchReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const farmId = useCurrentFarmId();

  const report = useQuery({
    queryKey: ['cold-batch-report', id, farmId],
    queryFn: () => endpoints.coldChainBatchReport(id),
    enabled: !!farmId,
  });

  const data = report.data;
  const clean = (data?.summary.excursions ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/cold-chain/batches"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Stock
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-brand-border)] px-3 text-[12.5px] font-semibold hover:bg-[var(--color-brand-surface-soft)]"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>

      {report.isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--color-brand-surface-soft)]" />
      ) : (
        <>
          <PageHeader
            eyebrow="Cold chain record"
            title={data.batch.label}
            description={[
              data.batch.batch_code,
              data.batch.supplier ? `from ${data.batch.supplier}` : null,
              data.batch.customer ? `for ${data.batch.customer}` : null,
              data.batch.room,
            ]
              .filter(Boolean)
              .join(' · ')}
          />

          {/* The verdict, first and in one sentence. Everything below
              is the evidence for it. */}
          <div
            className={cn(
              'rounded-2xl border p-5',
              clean ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50',
            )}
          >
            <div className="flex items-start gap-3">
              {clean ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              ) : (
                <ThermometerSun className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              )}
              <div>
                <p
                  className={cn(
                    'text-[15px] font-bold',
                    clean ? 'text-emerald-900' : 'text-rose-900',
                  )}
                >
                  {data.summary.verdict}
                </p>
                {data.batch.value_amount !== null && (
                  <p
                    className={cn(
                      'mt-1 text-[13px]',
                      clean ? 'text-emerald-800' : 'text-rose-800',
                    )}
                  >
                    Declared value {money(data.batch.value_amount, data.batch.currency)}
                    {data.batch.quantity
                      ? ` · ${data.batch.quantity}${data.batch.unit ? ` ${data.batch.unit}` : ''}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {data.exposures.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
                Excursions
              </h2>
              <div className="space-y-3">
                {data.exposures.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-bold">
                        {e.peak_temp_c !== null ? `${e.peak_temp_c}°C` : '—'}{' '}
                        <span className="font-normal text-[var(--color-brand-muted)]">
                          {e.direction === 'below' ? 'below band' : 'above band'}
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
                    <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
                      {e.room ? `${e.room} · ` : ''}
                      {e.started_at ? new Date(e.started_at).toLocaleString() : '—'}
                      {e.ended_at ? ` to ${new Date(e.ended_at).toLocaleTimeString()}` : ''}
                    </p>
                    {e.acknowledged_at && (
                      <p className="mt-1 text-[12px] text-emerald-700">
                        Acknowledged {new Date(e.acknowledged_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
