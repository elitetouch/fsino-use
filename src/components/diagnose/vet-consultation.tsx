'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Stethoscope, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { endpoints, type ConsultationDto } from '@/lib/api';

/**
 * "Do you want a vet to look at this?" — yes or no.
 *
 * WHY THIS IS ON EVERY RESULT, INCLUDING REFUSALS
 * -----------------------------------------------
 * The model is in beta because it is genuinely unreliable on real farm
 * photos: it refuses actual droppings, and before its guards were fixed
 * it diagnosed a photograph of groceries as coccidiosis at full
 * confidence. A farmer holding a refusal — or an answer they doubt,
 * about birds they are watching get sick — otherwise has nowhere to go.
 *
 * It matters MOST on a refusal. "We could not read this photo" is the
 * moment a person is most obviously needed, and an inconclusive result
 * with no next step is the worst thing this feature does.
 *
 * ONE TAP, NO FORM
 * ----------------
 * No "describe your problem" box, deliberately. Everything a vet would
 * ask — the birds' age, mortality and its trend, vaccines given and
 * missed, recent medication, feed and water — is already recorded and
 * is sent with the request automatically. Asking a worried farmer to
 * retype what the app already knows is how a request does not get made
 * at all.
 */
export function VetConsultation({
  diagnosisId,
  initial,
}: {
  diagnosisId: string;
  /** Present when reopening a past check; absent on a fresh result. */
  initial?: Pick<ConsultationDto, 'consultationRequested' | 'vetReply' | 'vetRepliedAt'>;
}) {
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState(initial?.consultationRequested ?? false);

  // "No thanks" is local only — see the button below on why declining
  // writes nothing to the server.
  const [dismissed, setDismissed] = useState(false);

  const mutation = useMutation({
    mutationFn: (next: boolean) => endpoints.setDiagnosisConsultation(diagnosisId, next),
    // Optimistic: the tap is the whole interaction, and a spinner where
    // a confirmation should be makes people tap twice.
    onMutate: (next) => {
      const previous = requested;
      setRequested(next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      setRequested(context?.previous ?? false);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diagnoses'] });
    },
  });

  // A vet has already answered. The question is gone; what remains is
  // the reply, which is the most valuable thing on this screen.
  if (initial?.vetReply) {
    return (
      <div className="rounded-xl border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-accent)]/25 p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary)] text-white">
            <UserRound className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
              Our vet&rsquo;s reply
            </p>
            {initial.vetRepliedAt ? (
              <p className="text-[11px] text-[var(--color-brand-muted)]">
                {new Date(initial.vetRepliedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            ) : null}
          </div>
        </div>

        {/* whitespace-pre-line: a vet writing clinical advice uses line
            breaks for steps, and collapsing them turns a treatment plan
            into a paragraph. */}
        <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--color-brand-fg)]">
          {initial.vetReply}
        </p>
      </div>
    );
  }

  if (dismissed && !requested) {
    return null;
  }

  if (requested) {
    return (
      <div className="rounded-xl border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-accent)]/25 p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-[var(--color-brand-fg)]">
              A vet will review this
            </p>
            {/* No promised turnaround time. There is one part-time vet,
                and a missed "within 24 hours" is worse than no number. */}
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-brand-muted)]">
              We&rsquo;ve sent your photo and this cycle&rsquo;s records to our vet.
              You&rsquo;ll get a notification when they reply.
            </p>

            <button
              type="button"
              onClick={() => mutation.mutate(false)}
              disabled={mutation.isPending}
              className="mt-2 text-[12px] font-semibold text-[var(--color-brand-muted)] underline underline-offset-2 disabled:opacity-50"
            >
              Cancel this request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-primary-deep)]">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-[var(--color-brand-fg)]">
            Want a vet to check this?
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-brand-muted)]">
            One of our vets will look at your photo alongside this cycle&rsquo;s
            records and reply. No extra charge.
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => mutation.mutate(true)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Stethoscope className="h-3.5 w-3.5" />
          )}
          Yes, please
        </Button>
        {/* "No" dismisses locally and writes nothing. Recording every
            decline would fill the table with rows that mean only "this
            farmer read the prompt". */}
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => setDismissed(true)}
          disabled={mutation.isPending}
        >
          No thanks
        </Button>
      </div>
    </div>
  );
}
