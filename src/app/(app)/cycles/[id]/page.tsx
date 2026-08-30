'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  ArrowLeft, Calendar, MapPin, Plus, CheckCircle2, XCircle, Loader2, X, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { CyclePicker } from '@/components/app/cycle-picker';
import { CycleCardsGrid } from '@/components/app/cycle-cards-grid';
import { PenClimateWithHistory } from '@/components/app/pen-climate';
import { CycleFinanceTab } from '@/components/app/cycle-finance-tab';
import {
  apiErrorMessage, endpoints,
  type FlockDto, type PenDto,
  type FlockCloseOutReason, type ArchiveFlockOpts,
} from '@/lib/api';
import { Gate } from '@/lib/access';
import { useCurrentFarmId } from '@/lib/farm-context';
import { readUser } from '@/lib/auth';
import { writeLastCycle } from '@/lib/last-cycle';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { flocksKey } from '@/lib/query-keys';

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
  const farmId = useCurrentFarmId();
  const router = useRouter();
  // ?tab=climate|results|finance lets the dashboard link straight to
  // the Pen climate tab. Falls back to 'results' for any unknown or
  // missing value.
  const search = useSearchParams();
  const initialTab: Tab = (() => {
    const v = search?.get('tab');
    return v === 'climate' || v === 'finance' ? v : 'results';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  const flocks = useQuery({
    // Archived cycles are included deliberately: this page has to be
    // able to open a COMPLETED cycle, and an active-only list would
    // make it 404 on a cold load. Previously this shared a cache key
    // with /reports (which does include archived), so whether an
    // archived cycle rendered depended on which page you'd visited
    // first — the same URL worked or 404'd by navigation history.
    queryKey: flocksKey(farmId, { includeArchived: true }),
    queryFn: () => endpoints.listFlocks({ includeArchived: true }),
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

  // Farm switched to one whose flocks don't include this cycle id —
  // e.g. the user was viewing a farm-A cycle and picked farm B in the
  // topbar. Bounce back to /cycles for the newly-selected farm rather
  // than render an empty picker + "not attached to a pen" placeholder.
  useEffect(() => {
    if (!farmId) return;
    if (flocks.isLoading || !flocks.data) return;
    if (!cycle) router.replace('/cycles');
  }, [farmId, flocks.isLoading, flocks.data, cycle, router]);

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
          <PenClimateWithHistory penId={pen.id} penName={pen.name} flockId={cycle.id} />
        ) : (
          <PlaceholderTab title="Pen climate" body="This cycle isn't attached to a pen yet." />
        )
      ) : tab === 'finance' ? (
        <CycleFinanceTab flockId={cycle.id} />
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
  const [closeOut, setCloseOut] = useState<null | 'complete' | 'terminate'>(null);

  const completedDate = cycle.validUntil ?? cycle.startDate;

  // A cycle is closed once the backend stamps archived_at — via
  // Complete cycle, End early, or the nightly auto-archive.
  const isArchived = cycle.archivedAt != null;

  const archive = useMutation({
    mutationFn: (opts: ArchiveFlockOpts) => endpoints.archiveFlock(cycle.id, opts),
    onSuccess: (_res, opts) => {
      const label = opts.outcome === 'terminated' ? 'ended early' : 'completed';
      toast.success(`Cycle ${ordinal} ${label} — pen ${pen?.name ?? ''} is now free.`);
      qc.invalidateQueries({ queryKey: ['flocks'] });
      qc.invalidateQueries({ queryKey: ['pens'] });
      router.push('/cycles');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not close this cycle.')),
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
        {/* A closed cycle is a finished record, not a live one. Offering
            "Complete cycle" on something already complete is nonsense,
            and "End early" would 404 against an archived flock — so the
            only action left is reading the report. */}
        {isArchived ? (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-muted)]">
              <CheckCircle2 className="h-3 w-3" />
              {cycle.outcome === 'terminated' ? 'Ended early' : 'Completed'}
            </span>
            <Button asChild size="sm" className="h-9">
              <Link href={`/reports?flock=${cycle.id}`}>
                <FileText className="h-3.5 w-3.5" />
                View full report
              </Link>
            </Button>
          </div>
        ) : (
          <Gate perm="flocks.archive">
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-[var(--color-brand-primary)] text-[var(--color-brand-primary-deep)]"
                onClick={() => setCloseOut('complete')}
                disabled={archive.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete cycle
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[var(--color-brand-danger)]"
                onClick={() => setCloseOut('terminate')}
                disabled={archive.isPending}
              >
                <XCircle className="h-3.5 w-3.5" />
                End early
              </Button>
            </div>
          </Gate>
        )}
      </article>

      {closeOut !== null && (
        <CloseOutSheet
          mode={closeOut}
          cycle={cycle}
          penName={pen?.name}
          submitting={archive.isPending}
          onClose={() => setCloseOut(null)}
          onSubmit={(opts) => archive.mutate({ force: true, ...opts })}
        />
      )}

      <CycleCardsGrid cycle={cycle} penId={pen?.id} />

      {/* Quick-add row — hidden on a closed cycle. The backend rejects
          writes to an archived flock, so showing the button would only
          lead the farmer into an error. */}
      {!isArchived && (
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
      )}
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

const CLOSE_OUT_REASONS: { value: FlockCloseOutReason; label: string }[] = [
  { value: 'disease_outbreak', label: 'Disease outbreak' },
  { value: 'high_mortality', label: 'High mortality' },
  { value: 'poor_fcr', label: 'Poor FCR / feed conversion' },
  { value: 'market_conditions', label: 'Market conditions' },
  { value: 'owner_decision', label: 'Owner decision' },
  { value: 'other', label: 'Other (explain in notes)' },
];

/**
 * Close-out bottom sheet — two modes:
 *   - complete   → captures final bird count + avg weight so the P&L
 *                  reflects the true sale-day snapshot even if the last
 *                  weigh-in was earlier.
 *   - terminate  → reason picker + freeform notes. Reason categories
 *                  become filterable analytics later.
 * Both modes archive the flock and free the pen server-side.
 */
function CloseOutSheet({
  mode, cycle, penName, submitting, onClose, onSubmit,
}: {
  mode: 'complete' | 'terminate';
  cycle: FlockDto;
  penName?: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (opts: ArchiveFlockOpts) => void;
}) {
  const [finalBirds, setFinalBirds] = useState<string>(String(cycle.currentBirds ?? cycle.placedBirds ?? ''));
  const [avgWeight, setAvgWeight] = useState<string>('');
  const [reason, setReason] = useState<FlockCloseOutReason>('disease_outbreak');
  const [notes, setNotes] = useState<string>('');

  const isComplete = mode === 'complete';
  const canSubmit = !submitting && (isComplete
    ? true
    : (reason !== 'other' || notes.trim().length > 0));

  const submit = () => {
    if (isComplete) {
      const birds = finalBirds.trim() === '' ? undefined : Number(finalBirds);
      const weight = avgWeight.trim() === '' ? undefined : Number(avgWeight);
      onSubmit({
        outcome: 'completed',
        close_out_notes: notes.trim() || undefined,
        final_birds_sold: Number.isFinite(birds as number) ? (birds as number) : undefined,
        final_avg_weight_g: Number.isFinite(weight as number) ? (weight as number) : undefined,
      });
      return;
    }
    onSubmit({
      outcome: 'terminated',
      close_out_reason: reason,
      close_out_notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-fade-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.30)] sm:max-w-[560px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md',
              isComplete
                ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                : 'bg-rose-50 text-[var(--color-brand-danger)]',
            )}>
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">
                {isComplete ? 'Complete cycle' : 'End cycle early'}
              </p>
              <p className="text-[11px] text-[var(--color-brand-muted)]">
                {isComplete
                  ? `Confirm final numbers, then archive. Pen ${penName ?? ''} becomes free.`
                  : `Tell us why so future reports stay honest. Pen ${penName ?? ''} becomes free.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {isComplete ? (
            <>
              <div>
                <Label htmlFor="finalBirds">Final bird count (sold or in pen at close)</Label>
                <Input
                  id="finalBirds"
                  inputMode="numeric"
                  value={finalBirds}
                  onChange={(e) => setFinalBirds(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={String(cycle.currentBirds ?? cycle.placedBirds ?? 0)}
                />
              </div>
              <div>
                <Label htmlFor="avgWeight">Final average bird weight (grams, optional)</Label>
                <Input
                  id="avgWeight"
                  inputMode="numeric"
                  value={avgWeight}
                  onChange={(e) => setAvgWeight(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 2400"
                />
              </div>
            </>
          ) : (
            <div>
              <Label>Why is this cycle ending early?</Label>
              <div className="mt-1 grid gap-2">
                {CLOSE_OUT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2.5 text-left text-[12.5px] font-semibold transition-all',
                      reason === r.value
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40 text-[var(--color-brand-primary-deep)]'
                        : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-fg)] hover:border-[var(--color-brand-primary)]/40',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="closeNotes">
              Notes {isComplete ? '(optional)' : reason === 'other' ? '(required)' : '(optional)'}
            </Label>
            <textarea
              id="closeNotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isComplete
                ? 'Anything worth remembering about this cycle?'
                : 'Add the specifics — dates, symptoms, decisions.'}
              className="w-full rounded-xl border border-[var(--color-brand-input-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-brand-fg)] outline-none placeholder:text-[var(--color-brand-muted-soft)] focus:border-[var(--color-brand-primary)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-brand-border)] bg-white px-5 py-4">
          <Button variant="outline" size="sm" className="h-10" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className={cn(
              'h-10',
              !isComplete && 'bg-[var(--color-brand-danger)] hover:bg-[#a72027]',
            )}
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : isComplete
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : <XCircle className="h-3.5 w-3.5" />}
            {isComplete ? 'Confirm & archive' : 'End cycle & archive'}
          </Button>
        </div>
      </div>
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


