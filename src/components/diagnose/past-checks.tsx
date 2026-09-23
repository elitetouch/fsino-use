'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Stethoscope, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { endpoints, type DiagnosisHistoryDto } from '@/lib/api';
import { VetConsultation } from '@/components/diagnose/vet-consultation';

/**
 * Past checks, and — the reason this exists — the vet's replies.
 *
 * WHY THIS IS NOT OPTIONAL
 * ------------------------
 * When a vet answers a consultation the farmer gets a push that deep
 * links to `/diagnose?check=<id>`. Without a screen that can show that
 * check, the whole loop is broken at its last step: a vet writes real
 * clinical advice, the farmer is told it exists, and there is nowhere to
 * read it. A reply nobody can read is worse than no reply, because
 * somebody's time was spent producing it.
 *
 * So the deep link expands the named check automatically and scrolls to
 * it. Everything else here — the list, the collapsing — is in service of
 * that one path working.
 *
 * The list is deliberately quiet: collapsed rows, no imagery, below the
 * camera. Someone opening this page usually has sick birds and wants the
 * camera, not an archive.
 */
export function PastChecks({ highlightId }: { highlightId?: string | null }) {
  const [expanded, setExpanded] = useState<string | null>(highlightId ?? null);

  const history = useQuery({
    queryKey: ['diagnoses'],
    queryFn: () => endpoints.listDiagnoses(),
  });

  const checks: DiagnosisHistoryDto[] = history.data?.diagnoses ?? [];

  // Expand and scroll to the check a notification pointed at. Waits for
  // the row to exist — the query is still in flight on first paint, so
  // scrolling immediately would land on nothing.
  useEffect(() => {
    if (!highlightId || checks.length === 0) return;

    setExpanded(highlightId);
    const node = document.getElementById(`check-${highlightId}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, checks.length]);

  if (history.isLoading || checks.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]">
        Past checks
      </h2>

      <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
        {checks.map((check) => {
          const open = expanded === check.id;
          const hasReply = check.vet_reply !== null;
          const waiting = check.vet_consultation_requested_at !== null && !hasReply;

          return (
            <div key={check.id} id={`check-${check.id}`}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : check.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84375rem] font-semibold text-[var(--color-brand-fg)]">
                    {check.predicted_class ?? 'No result'}
                    {check.confidence !== null && (
                      <span className="font-normal text-[var(--color-brand-muted)]">
                        {' '}
                        · {Math.round(check.confidence)}%
                      </span>
                    )}
                  </p>
                  <p className="text-[0.71875rem] text-[var(--color-brand-muted)]">
                    {new Date(check.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* A reply waiting to be read is the only thing on this
                    row worth interrupting for, so it is the only badge. */}
                {hasReply && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-primary)] px-2 py-0.5 text-[0.65625rem] font-bold text-white">
                    <UserRound className="h-3 w-3" />
                    Vet replied
                  </span>
                )}
                {waiting && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-surface-soft)] px-2 py-0.5 text-[0.65625rem] font-semibold text-[var(--color-brand-muted)]">
                    <Stethoscope className="h-3 w-3" />
                    With vet
                  </span>
                )}

                <ChevronDown
                  className={[
                    'h-4 w-4 shrink-0 text-[var(--color-brand-muted)] transition-transform',
                    open ? 'rotate-180' : '',
                  ].join(' ')}
                />
              </button>

              {open && (
                <div className="space-y-3 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-3">
                  {check.inconclusive_reason && (
                    <p className="text-[0.78125rem] leading-relaxed text-[var(--color-brand-muted)]">
                      {check.inconclusive_reason}
                    </p>
                  )}

                  {/* Renders the vet's reply when there is one, the
                      waiting state when a request is open, and the
                      yes/no prompt when neither — one component, because
                      they are three states of the same thing. */}
                  <VetConsultation
                    diagnosisId={check.id}
                    initial={{
                      consultationRequested: check.vet_consultation_requested_at !== null,
                      vetReply: check.vet_reply,
                      vetRepliedAt: check.vet_replied_at,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
