'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  ArrowLeft, Calendar, MapPin, Plus, Archive, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CyclePicker } from '@/components/app/cycle-picker';
import { CycleCardsGrid } from '@/components/app/cycle-cards-grid';
import { PenClimate } from '@/components/app/pen-climate';
import { apiErrorMessage, endpoints, type FlockDto, type PenDto } from '@/lib/api';
import { Gate } from '@/lib/access';
import { readCurrentFarmId } from '@/lib/farm-context';
import { readUser } from '@/lib/auth';
import { writeLastCycle } from '@/lib/last-cycle';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'results' | 'climate' | 'finance';

/**
 * Cycle results — the live dashboard for one selected cycle (flock).
 *
 * Layout:
 *   - Dark green header strip with back link, picker, and tabs
 *     (Cycle results / Pen climate / Finance) mirroring the mobile bar.
 *   - Below the strip: cycle metadata row + 6-card grid in 2 columns
 *     on lg.
 *
 * Backend-data cards that don't yet have a feed render empty states so
 * the layout stays world-class while real numbers are wired in.
 */
export default function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const farmId = readCurrentFarmId();
  const [tab, setTab] = useState<Tab>('results');

  const flocks = useQuery({
    queryKey: ['flocks', farmId],
    queryFn: () => endpoints.listFlocks(),
    enabled: !!farmId,
  });

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  const cycle = (flocks.data?.flocks ?? []).find((f) => f.id === id);
  const pen: PenDto | undefined = (pens.data?.pens ?? []).find((p) => p.id === cycle?.penId);
  const allCycles: FlockDto[] = flocks.data?.flocks ?? [];
  const ordinal = Math.max(1, allCycles.findIndex((c) => c.id === id) + 1);

  // Remember the last cycle this user opened on this farm so the
  // dashboard can land them back here next time. Only write once we've
  // confirmed the cycle actually belongs to the active farm's flocks —
  // otherwise a deep-link to an archived/foreign id would poison the
  // memory and pin the user to a cycle that errors on read.
  useEffect(() => {
    if (!farmId || !cycle) return;
    const user = readUser();
    if (!user?.id) return;
    writeLastCycle(farmId, user.id, cycle.id);
  }, [farmId, cycle]);

  return (
    <div className="space-y-5">
      {/* Header strip — the dark-green "Cycle results" bar from mobile.
          NOTE: no `overflow-hidden` here. The CyclePicker dropdown is
          absolutely-positioned and drops down PAST the section edge;
          a clipping ancestor (overflow-hidden) would chop the menu
          to an invisible sliver of white space. `rounded-xl` alone
          still clips the background fill via border-radius — we only
          lose decorative-overflow clipping, of which there is none. */}
      <section className="rounded-xl bg-[var(--color-brand-primary-dark)] text-white shadow-[0_10px_30px_-15px_rgba(15,80,30,0.40)]">
        <div className="px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/cycles"
              aria-label="All cycles"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <p className="text-[14px] font-bold tracking-tight">Cycle results</p>
            <div aria-hidden className="h-8 w-8" />
          </div>

          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <CyclePicker
              cycles={allCycles}
              pens={pens.data?.pens ?? []}
              currentCycleId={id}
            />
            {/* Tab strip */}
            <div className="flex rounded-md bg-black/15 p-0.5">
              {[
                { key: 'results',  label: 'Cycle results' },
                { key: 'climate',  label: 'Pen climate' },
                { key: 'finance',  label: 'Finance' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key as Tab)}
                  className={cn(
                    'rounded-[5px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                    tab === t.key
                      ? 'bg-white text-[var(--color-brand-primary-dark)]'
                      : 'text-white/85 hover:text-white',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      {flocks.isLoading ? (
        <CardSkeleton />
      ) : !cycle ? (
        <NotFound />
      ) : tab === 'climate' ? (
        pen ? (
          <PenClimate penId={pen.id} penName={pen.name} />
        ) : (
          <PlaceholderTab title="Pen climate" body="This cycle isn't attached to a pen yet." />
        )
      ) : tab === 'finance' ? (
        <PlaceholderTab title="Finance" body="Track feed cost, vaccine cost and projected margin for this cycle here." />
      ) : (
        <ResultsTab cycle={cycle} pen={pen} ordinal={ordinal} />
      )}
    </div>
  );
}

function ResultsTab({
  cycle,
  pen,
  ordinal,
}: {
  cycle: FlockDto;
  pen?: PenDto;
  ordinal: number;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const completedDate = cycle.validUntil ?? cycle.startDate;

  const archive = useMutation({
    mutationFn: () => endpoints.archiveFlock(cycle.id, true),
    onSuccess: () => {
      toast.success(`Cycle ${ordinal} archived — pen ${pen?.name ?? ''} is now free.`);
      qc.invalidateQueries({ queryKey: ['flocks'] });
      qc.invalidateQueries({ queryKey: ['pens'] });
      router.push('/cycles');
    },
    onError: (err) => {
      const ax = err as AxiosError<{ data?: { code?: string } }>;
      // 409 = warning, expected first time. Open the confirm dialog
      // so the user can force=true on the next click.
      if (ax.response?.status === 409) {
        setConfirmingArchive(true);
        return;
      }
      toast.error(apiErrorMessage(err, 'Could not archive this cycle.'));
    },
  });

  return (
    <>
      {/* Cycle meta row */}
      <article className="flex flex-col gap-3 rounded-xl border border-[var(--color-brand-border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Calendar className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">Cycle {ordinal}</p>
            <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">
              Started {fmtDate(cycle.startDate)}
              {completedDate && completedDate !== cycle.startDate ? ` · ends ${fmtDate(completedDate)}` : ''}
              {pen && (
                <>
                  {' · '}<MapPin className="inline h-3 w-3" /> {pen.name}
                </>
              )}
            </p>
          </div>
        </div>
        <Gate perm="flocks.archive">
          <Button
            variant="outline"
            size="sm"
            className="h-9 self-start text-[var(--color-brand-danger)] sm:self-auto"
            onClick={() => archive.mutate()}
            disabled={archive.isPending}
          >
            {archive.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Archive cycle
          </Button>
        </Gate>
      </article>

      {confirmingArchive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] font-bold text-amber-900">This cycle is still active</p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
            Archiving will end tracking, free pen <strong>{pen?.name ?? '—'}</strong>, and stop
            future records from being attached to this cycle. The data stays on file.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setConfirmingArchive(false)}
              disabled={archive.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-9 bg-[var(--color-brand-danger)] hover:bg-[#a72027]"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
            >
              {archive.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              Yes, archive cycle
            </Button>
          </div>
        </div>
      )}

      <CycleCardsGrid cycle={cycle} penId={pen?.id} />

      {/* Quick-add row */}
      <section className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">Add today&rsquo;s record</p>
            <p className="text-[11.5px] text-[var(--color-brand-muted)]">
              Log feed, water, mortality and vaccines for this cycle.
            </p>
          </div>
          <Gate perm="flocks.records.create">
            <Button asChild size="sm">
              <Link href={`/cycles/${cycle.id}/record`}>
                <Plus className="h-3.5 w-3.5" />
                Add record
              </Link>
            </Button>
          </Gate>
        </div>
      </section>
    </>
  );
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{title} — coming soon</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] text-[var(--color-brand-muted)]">{body}</p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-white" />
      ))}
    </div>
  );
}

function NotFound() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">Cycle not found</p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
        It may have been archived. Pick another cycle.
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/cycles">Back to cycles</Link>
      </Button>
    </div>
  );
}


