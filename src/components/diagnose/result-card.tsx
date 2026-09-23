'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle, Camera, CheckCircle2, Eye, FileText, Info, Loader2,
  ShieldAlert, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { ReferenceImages } from '@/components/diagnose/reference-images';
import { VetConsultation } from '@/components/diagnose/vet-consultation';
import { Button } from '@/components/ui/button';
import { endpoints, apiErrorMessage, type DiagnosisDto } from '@/lib/api';
import { confidenceBand, diseaseFraming, refusalCopy } from '@/lib/diagnosis-copy';

/**
 * The answer.
 *
 * ORDERING IS THE DESIGN. A farmer reads the top of this card and acts.
 * So it goes: what it is → how sure → WHAT TO DO. The treatment is the
 * reason they opened the app; the confidence score is context for it,
 * not the headline, and the model's internals are further down still.
 *
 * The four diseases are not presented identically, because they do not
 * demand the same response. Newcastle has no cure and is reportable;
 * showing it in the same calm card as coccidiosis, under a heading that
 * says "Treatment", would actively mislead someone into dosing birds
 * they should be isolating. See diseaseFraming().
 */
export function ResultCard({
  result,
  onRetake,
}: {
  result: DiagnosisDto;
  onRetake: () => void;
}) {
  if (!result.conclusive) {
    return <RefusalCard result={result} onRetake={onRetake} />;
  }

  const band = confidenceBand(result.confidence);
  const framing = diseaseFraming(result.disease);
  const healthy = framing.urgency === 'none';
  const critical = framing.urgency === 'critical';
  const info = result.diseaseInfo ?? {};

  return (
    <div className="space-y-4">
      {/* ---- The verdict ---- */}
      <div
        className={[
          'rounded-xl border p-5',
          healthy
            ? 'border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-accent)]/40'
            : critical
              ? 'border-[var(--color-brand-danger)]/40 bg-[var(--color-brand-danger)]/[0.06]'
              : 'border-[var(--color-brand-border)] bg-white',
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          <span
            className={[
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              healthy
                ? 'bg-[var(--color-brand-primary)] text-white'
                : critical
                  ? 'bg-[var(--color-brand-danger)] text-white'
                  : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
            ].join(' ')}
          >
            {healthy ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : critical ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-[1.1875rem] font-extrabold leading-tight text-[var(--color-brand-fg)]">
              {result.disease}
            </h2>
            <p className="mt-0.5 text-[0.78125rem] text-[var(--color-brand-muted)]">
              {band.label} · {band.note}
            </p>
          </div>
        </div>

        {/* The single most important sentence, before any treatment
            detail. For Newcastle it is "separate the birds and call a
            vet" — which a farmer must read BEFORE they see a dosage
            table and start medicating. */}
        {framing.leadWith && (
          <p
            className={[
              'mt-3.5 text-[0.84375rem] font-medium leading-relaxed',
              critical ? 'text-[var(--color-brand-danger)]' : 'text-[var(--color-brand-fg)]',
            ].join(' ')}
          >
            {framing.leadWith}
          </p>
        )}
      </div>

      {/* ---- What to do ---- */}
      {!healthy && (info.treatment || info.next_action || info.dosage) && (
        <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]">
            {framing.headline}
          </h3>

          <dl className="mt-3 space-y-3">
            {info.treatment && <Field label="Treatment" value={info.treatment} />}
            {info.dosage && <Field label="Dosage" value={info.dosage} />}
            {info.next_action && <Field label="Next step" value={info.next_action} />}
          </dl>

          <p className="mt-3.5 flex items-start gap-1.5 text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              This is guidance, not a prescription. Confirm dosages with a vet before treating —
              especially for young birds or a flock already on medication.
            </span>
          </p>
        </section>
      )}

      {/* ---- Symptoms, to sanity-check against the actual birds ----
           The section shows if EITHER the text or the photographs are
           available. Gating the whole thing on `symptoms` would hide a
           full reference gallery because one CSV cell was blank. */}
      {(info.symptoms || (result.referenceImages ?? []).length > 0) && (
        <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]">
            Does this match what you are seeing?
          </h3>
          {info.symptoms && (
            <p className="mt-2 text-[0.84375rem] leading-relaxed text-[var(--color-brand-fg)]">
              {info.symptoms}
            </p>
          )}
          <ReferenceImages images={result.referenceImages ?? []} />

          <p className="mt-2 text-[0.71875rem] text-[var(--color-brand-muted)]">
            If your birds show none of these, treat the result with caution.
          </p>
        </section>
      )}

      {result.gradcamOverlay && <WhatItLookedAt image={result.gradcamOverlay} />}

      <Feedback diagnosisId={result.id} />

      {/* Offered after the answer, not instead of it. A farmer who
          trusts this result skips it; one who doesn't now has somewhere
          to go other than away. */}
      <VetConsultation diagnosisId={result.id} />

      {/* Only offered when the check is attached to a cycle — there is
          no report for one that is not. */}
      {result.flockId && (
        <AddToReport diagnosisId={result.id} initial={result.includeInReport} />
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={onRetake}>
        <Camera className="h-3.5 w-3.5" />
        Check another photo
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.71875rem] font-semibold text-[var(--color-brand-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[0.84375rem] leading-relaxed text-[var(--color-brand-fg)]">{value}</dd>
    </div>
  );
}

/**
 * The Grad-CAM overlay, collapsed by default.
 *
 * Valuable but not load-bearing: a farmer wants the answer, while a vet
 * reviewing a surprising result wants to know whether the model looked
 * at the droppings or at the bucket behind them. Putting it behind a
 * tap serves both without pushing the treatment further down the page.
 */
function WhatItLookedAt({ image }: { image: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-4 text-left"
        aria-expanded={open}
      >
        <Eye className="h-4 w-4 text-[var(--color-brand-muted)]" />
        <span className="flex-1 text-[0.8125rem] font-semibold text-[var(--color-brand-fg)]">
          See what the app looked at
        </span>
        <span className="text-[0.75rem] text-[var(--color-brand-muted)]">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/jpeg;base64,${image}`}
            alt="Your photo with the areas the app focused on highlighted"
            className="w-full rounded-lg border border-[var(--color-brand-border)]"
          />
          <p className="mt-2 text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
            The bright areas are what the app paid most attention to. If those areas are not on the
            droppings, the result is less trustworthy — take another photo closer in.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Was it right?
 *
 * Every answer pairs a real field photograph with a verdict, which is
 * the only honest measure of accuracy in deployment and the dataset any
 * retrain depends on.
 *
 * Asked once, answered in one tap, and gone. A prompt that nags, or
 * demands a form, gets dismissed reflexively — and a reflexive answer
 * is worse than none, because it becomes a wrong label in the training
 * set.
 */
function Feedback({ diagnosisId }: { diagnosisId: string }) {
  const [sent, setSent] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: (feedback: 'agreed' | 'disagreed') =>
      endpoints.submitDiagnosisFeedback(diagnosisId, feedback),
    onSuccess: (_d, feedback) => setSent(feedback),
    onError: (e) => setSent(apiErrorMessage(e, 'error')),
  });

  if (sent === 'agreed' || sent === 'disagreed') {
    return (
      <p className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-3 text-center text-[0.78125rem] text-[var(--color-brand-muted)]">
        Thank you — this makes the tool better for every farmer using it.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-4">
      <p className="text-[0.8125rem] font-semibold text-[var(--color-brand-fg)]">
        Does this match what you found?
      </p>
      <p className="mt-0.5 text-[0.71875rem] text-[var(--color-brand-muted)]">
        Your answer trains the tool on real Nigerian farms.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={mutate.isPending}
          onClick={() => mutate.mutate('agreed')}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Yes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={mutate.isPending}
          onClick={() => mutate.mutate('disagreed')}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          No
        </Button>
      </div>
    </section>
  );
}

/**
 * Put this result into the cycle report.
 *
 * SEPARATE FROM THE FEEDBACK ABOVE, and deliberately worded to make the
 * consequence clear. The cycle report goes to lenders, buyers and
 * insurers, who read every line as the farmer's own statement — so a
 * beta model's output belongs there only if the farmer decides it does,
 * having compared it against the birds in front of them.
 *
 * Defaults to off and stays off unless acted on. Nothing about running
 * a check implies wanting it on a bank document.
 */
function AddToReport({ diagnosisId, initial }: { diagnosisId: string; initial: boolean }) {
  const [included, setIncluded] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: (next: boolean) => endpoints.setDiagnosisInReport(diagnosisId, next),
    onSuccess: (_d, next) => {
      setIncluded(next);
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "Couldn't update the report.")),
  });

  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex items-start gap-2.5">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold text-[var(--color-brand-fg)]">
            {included ? 'Added to this cycle\u2019s report' : 'Add to this cycle\u2019s report'}
          </p>
          <p className="mt-0.5 text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
            {included
              ? 'It will appear alongside your treatment and mortality records.'
              : 'Your cycle report is shared with buyers and lenders. Only add a result you are confident in.'}
          </p>

          <Button
            size="sm"
            variant={included ? 'outline' : 'primary'}
            className="mt-3"
            disabled={mutate.isPending}
            onClick={() => mutate.mutate(!included)}
          >
            {mutate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {included ? 'Remove from report' : 'Add to report'}
          </Button>

          {error && (
            <p className="mt-2 text-[0.75rem] font-medium text-[var(--color-brand-danger)]">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The model declined to answer.
 *
 * Framed as a photo problem with a fix, never as a failure. "Unknown /
 * Not a chicken dropping image" is a dead end; "move closer and try
 * again" is a next step — and the difference decides whether someone
 * uses this tool twice.
 */
function RefusalCard({ result, onRetake }: { result: DiagnosisDto; onRetake: () => void }) {
  const copy = refusalCopy(result.reason);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]">
            <Camera className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.0625rem] font-extrabold leading-tight text-[var(--color-brand-fg)]">
              {copy.title}
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-brand-muted)]">
              {copy.body}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {copy.fixes.map((fix) => (
            <li key={fix} className="flex items-start gap-2 text-[0.8125rem] text-[var(--color-brand-fg)]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-primary)]" />
              {fix}
            </li>
          ))}
        </ul>
      </div>

      {/* THE most important placement of this prompt. A refusal is a
          dead end: the farmer still has sick birds and now has no
          answer at all. Retaking the photo is the first suggestion;
          a person is the one that always works. */}
      <VetConsultation diagnosisId={result.id} />

      <Button size="sm" variant="outline" className="w-full" onClick={onRetake}>
        <Camera className="h-3.5 w-3.5" />
        Take another photo
      </Button>
    </div>
  );
}
