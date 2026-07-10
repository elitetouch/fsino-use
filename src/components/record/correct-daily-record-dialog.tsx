'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, endpoints, type DailyRecordDto } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Append-only correction dialog for a single daily record.
 *
 * The farmer types what the entry SHOULD have been. This component
 * computes the signed offset client-side and POSTs it as a reversal
 * entry via endpoints.correctDailyRecord. Nothing on the original
 * mutates — it stays in the ledger next to the correction so a
 * bank / co-op reader always sees the full audit trail.
 *
 * Guards baked in:
 *   - The Correct button on the parent should already be disabled for
 *     rows where `correctionOfId !== null` (corrections can't be
 *     corrected), but we double-check here and refuse.
 *   - Reason is required (min 3 chars) and shown next to the corrected
 *     value in the daily-records CSV export.
 *   - Zero-offset submissions are refused — nothing to correct.
 */
export function CorrectDailyRecordDialog({
  flockId,
  record,
  open,
  onClose,
}: {
  flockId: string;
  /** The original entry the farmer wants to fix. */
  record: DailyRecordDto | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // Which field(s) this event type uses. mortality/sale drive
  // birds_delta; feed / water / eggs / weight drive quantity; the
  // farmer can additionally correct the amount on any monetary event.
  const usesBirdsDelta = record !== null && ['mortality', 'sale'].includes(record.eventType);
  const usesQuantity = record !== null && ['feed', 'water', 'eggs', 'weight'].includes(record.eventType);
  const usesAmount = record !== null && ['feed', 'water', 'vaccination', 'treatment', 'sale'].includes(record.eventType);

  // Text-string state so the user can clear and re-type freely; numeric
  // parsing happens at submit time.
  const [desiredBirds, setDesiredBirds] = useState<string>('');
  const [desiredQty, setDesiredQty] = useState<string>('');
  const [desiredAmount, setDesiredAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // Seed the fields with the ORIGINAL values so a farmer only needs to
  // change the ones that are wrong. Reset every time a new record opens.
  useEffect(() => {
    if (!record) return;
    setDesiredBirds(record.birdsDelta !== null ? String(record.birdsDelta) : '');
    setDesiredQty(record.quantity !== null ? String(record.quantity) : '');
    setDesiredAmount(record.amount !== null ? String(record.amount) : '');
    setReason('');
  }, [record?.id]);

  const correct = useMutation({
    mutationFn: (payload: {
      birds_delta?: number;
      quantity?: number;
      amount?: number;
      reason: string;
    }) => endpoints.correctDailyRecord(flockId, record!.id, payload),
    onSuccess: () => {
      toast.success('Correction posted. The original entry stays for the audit trail.');
      qc.invalidateQueries({ queryKey: ['flock-report', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-records', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-record-calendar', flockId] });
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not post the correction.')),
  });

  const proposedDelta = useMemo(() => {
    if (!record) return { birds: 0, qty: 0, amount: 0 };
    const birds = usesBirdsDelta
      ? Number(desiredBirds || 0) - Number(record.birdsDelta ?? 0)
      : 0;
    const qty = usesQuantity
      ? Number(desiredQty || 0) - Number(record.quantity ?? 0)
      : 0;
    const amount = usesAmount
      ? Number(desiredAmount || 0) - Number(record.amount ?? 0)
      : 0;
    return { birds, qty, amount };
  }, [record, usesBirdsDelta, usesQuantity, usesAmount, desiredBirds, desiredQty, desiredAmount]);

  // Portal target — SSR-safe. On the server render nothing; the
  // dialog only ever appears after mount.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') setPortalTarget(document.body);
  }, []);

  // Escape closes; body scroll locks while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !record || !portalTarget) return null;

  const isCorrection = record.correctionOfId !== null;
  const nothingChanged =
    proposedDelta.birds === 0 && proposedDelta.qty === 0 && proposedDelta.amount === 0;
  const reasonOk = reason.trim().length >= 3 && reason.length <= 500;
  const canSubmit = !isCorrection && !nothingChanged && reasonOk && !correct.isPending;

  function onSubmit() {
    if (!record || !canSubmit) return;
    const payload: {
      birds_delta?: number;
      quantity?: number;
      amount?: number;
      reason: string;
    } = { reason: reason.trim() };
    if (usesBirdsDelta && proposedDelta.birds !== 0) payload.birds_delta = proposedDelta.birds;
    if (usesQuantity && proposedDelta.qty !== 0) payload.quantity = proposedDelta.qty;
    if (usesAmount && proposedDelta.amount !== 0) payload.amount = proposedDelta.amount;
    correct.mutate(payload);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correct-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
              Correct entry
            </p>
            <h2 id="correct-dialog-title" className="mt-0.5 text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Post a correction for {prettyType(record.eventType)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isCorrection ? (
          <div className="p-5">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
              <div>
                <p className="text-[13px] font-bold text-amber-900">This entry is itself a correction</p>
                <p className="mt-1 text-[12px] text-amber-900">
                  Corrections can&rsquo;t be corrected — post a new correction on the ORIGINAL entry instead.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/60 p-3 text-[11.5px] leading-relaxed text-[var(--color-brand-muted)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" />
              <p>
                Type what the entry <em>should have been</em>. We&rsquo;ll post a reversal entry that offsets the original — nothing gets deleted, and the fix (with your reason) is visible in the records CSV so your bank / co-op can trust the audit trail.
              </p>
            </div>

            {usesBirdsDelta && (
              <PairField
                label="Bird count"
                originalLabel="Originally recorded"
                originalValue={record.birdsDelta !== null ? String(record.birdsDelta) : '—'}
                inputLabel="Should have been"
                value={desiredBirds}
                onChange={setDesiredBirds}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                helperText={
                  proposedDelta.birds !== 0
                    ? `Reversal entry will record ${proposedDelta.birds > 0 ? '+' : ''}${proposedDelta.birds} birds against the original.`
                    : 'No change.'
                }
              />
            )}

            {usesQuantity && (
              <PairField
                label={`Quantity${record.unit ? ` (${record.unit})` : ''}`}
                originalLabel="Originally recorded"
                originalValue={record.quantity !== null ? String(record.quantity) : '—'}
                inputLabel="Should have been"
                value={desiredQty}
                onChange={setDesiredQty}
                type="number"
                inputMode="decimal"
                step="0.001"
                helperText={
                  proposedDelta.qty !== 0
                    ? `Reversal entry will record ${proposedDelta.qty > 0 ? '+' : ''}${proposedDelta.qty}${record.unit ? ' ' + record.unit : ''} against the original.`
                    : 'No change.'
                }
              />
            )}

            {usesAmount && (
              <PairField
                label={`Amount${record.currency ? ` (${record.currency})` : ''}`}
                originalLabel="Originally recorded"
                originalValue={record.amount !== null ? String(record.amount) : '—'}
                inputLabel="Should have been"
                value={desiredAmount}
                onChange={setDesiredAmount}
                type="number"
                inputMode="decimal"
                step="0.01"
                helperText={
                  proposedDelta.amount !== 0
                    ? `Reversal entry will record ${proposedDelta.amount > 0 ? '+' : ''}${proposedDelta.amount.toFixed(2)}${record.currency ? ' ' + record.currency : ''} against the original.`
                    : 'No change.'
                }
              />
            )}

            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]" htmlFor="correct-reason">
                Reason (required)
              </label>
              <textarea
                id="correct-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="e.g. Miscount — actual mortality was 1, not 18."
                className="mt-1 block w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3 py-2 text-[13.5px] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
              />
              <p className={cn('mt-1 text-[11px]', reasonOk ? 'text-[var(--color-brand-muted)]' : 'text-amber-800')}>
                {reasonOk
                  ? `Saved with the correction and shown in the records CSV. ${reason.length}/500 chars.`
                  : `At least 3 characters — bank readers rely on this to trust the audit. ${reason.length}/500 chars.`}
              </p>
            </div>
          </div>
        )}

        <footer className="flex flex-col gap-2 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/50 p-4 sm:flex-row-reverse sm:items-center sm:justify-start sm:p-5">
          {!isCorrection && (
            <Button size="sm" onClick={onSubmit} disabled={!canSubmit}>
              {correct.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : null}
              Post correction
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </footer>
      </div>
    </div>,
    portalTarget,
  );
}

function PairField({
  label, originalLabel, originalValue, inputLabel, value, onChange, helperText, ...rest
}: {
  label: string;
  originalLabel: string;
  originalValue: string;
  inputLabel: string;
  value: string;
  onChange: (v: string) => void;
  helperText?: string;
  type?: string;
  inputMode?: 'numeric' | 'decimal';
  min?: number;
  step?: number | string;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
        {label}
      </p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted)]">
            {originalLabel}
          </p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums text-[var(--color-brand-fg)]">
            {originalValue}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3 py-2 focus-within:border-[var(--color-brand-primary)] focus-within:ring-2 focus-within:ring-[var(--color-brand-primary)]/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
            {inputLabel}
          </p>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-0.5 block w-full bg-transparent text-[14px] font-bold tabular-nums text-[var(--color-brand-fg)] focus:outline-none"
            {...rest}
          />
        </div>
      </div>
      {helperText && (
        <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">{helperText}</p>
      )}
    </div>
  );
}

function prettyType(t: string): string {
  const map: Record<string, string> = {
    feed: 'feed',
    water: 'water',
    weight: 'weight',
    eggs: 'eggs',
    mortality: 'mortality',
    sale: 'sale',
    vaccination: 'vaccination',
    treatment: 'treatment',
    bird_count: 'bird count',
    note: 'note',
  };
  return map[t] ?? t;
}
