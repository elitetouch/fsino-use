'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, endpoints, type DailyRecordDto } from '@/lib/api';

/**
 * Void (soft-delete) an existing daily record with a mandatory reason.
 *
 * The row stays in the ledger — a bank / co-op reviewer will still see
 * it in the records CSV export alongside its actor and reason — but
 * every aggregation, list, and the wizard exclude it via the backend's
 * SoftDeletes global scope.
 *
 * The backend enforces the role gate (staff 10-min window, owner /
 * manager anytime) and reconciles flock.current_birds for
 * mortality / sale / bird_count records.
 *
 * UX rules baked in:
 *   - Reason is required (3-500 chars). Live counter tells the user why
 *     it's required and where the reason surfaces.
 *   - Voiding a mortality / sale / bird_count row adds the birds back
 *     to the running flock count. The dialog says so explicitly so the
 *     farmer isn't surprised when the count moves.
 *   - Voiding is destructive-looking (rose Trash icon), but the copy
 *     reassures that the row still survives in the audit trail.
 *   - Already-voided rows should never reach this dialog (parents
 *     hide the button on `voidedAt !== null`) but we guard anyway.
 */
export function VoidDailyRecordDialog({
  flockId,
  record,
  open,
  onClose,
  onVoided,
}: {
  flockId: string;
  record: DailyRecordDto | null;
  open: boolean;
  onClose: () => void;
  /** Optional callback fired AFTER the mutation succeeds and the query
      cache has been invalidated. Handy for callers that want to close
      a parent modal (e.g. the wizard) as a follow-up. */
  onVoided?: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  // Reset the reason whenever a new record opens so a previous typo
  // doesn't leak into the next void.
  useEffect(() => { setReason(''); }, [record?.id]);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') setPortalTarget(document.body);
  }, []);

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

  const voidRow = useMutation({
    mutationFn: () => endpoints.voidDailyRecord(flockId, record!.id, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('Entry voided. It stays in the ledger for audit but no longer counts.');
      qc.invalidateQueries({ queryKey: ['flock-report', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-records', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-record-calendar', flockId] });
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      qc.invalidateQueries({ queryKey: ['flocks'] });
      setReason('');
      onClose();
      onVoided?.();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not void the entry.')),
  });

  if (!open || !record || !portalTarget) return null;

  const alreadyVoided = record.voidedAt != null;
  const reasonOk = reason.trim().length >= 3 && reason.length <= 500;
  const canSubmit = !alreadyVoided && reasonOk && !voidRow.isPending;

  // Bird-affecting event types get an explicit "count will be
  // reconciled" notice so the running total moving isn't a surprise.
  const shiftsBirds = ['mortality', 'sale', 'bird_count'].includes(record.eventType);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-rose-700">
              Void entry
            </p>
            <h2 id="void-dialog-title" className="mt-0.5 text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Remove this {prettyType(record.eventType)} entry?
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

        {alreadyVoided ? (
          <div className="p-5">
            <div className="flex items-start gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-muted)]" />
              <div>
                <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">This entry is already voided</p>
                <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
                  Voided at {new Date(record.voidedAt!).toLocaleString()}. The row remains in the ledger for audit.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-[12.5px] font-bold text-amber-900">The row stays in the ledger</p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-900">
                Voiding is not a delete. The entry stays in your records CSV export next to your reason so a bank or co-op can trust the audit trail. Aggregations and the wizard just stop counting it.
                {shiftsBirds && (
                  <>
                    {' '}Your running flock count will be reconciled — the birds this entry took out will be added back.
                  </>
                )}
              </p>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]" htmlFor="void-reason">
                Reason (required)
              </label>
              <textarea
                id="void-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder={
                  record.eventType === 'vaccination'
                    ? 'e.g. Duplicate entry — vaccine already logged earlier that day.'
                    : 'e.g. Duplicate entry — logged twice by mistake.'
                }
                className="mt-1 block w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3 py-2 text-[13.5px] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
              />
              <p className={'mt-1 text-[11px] ' + (reasonOk ? 'text-[var(--color-brand-muted)]' : 'text-amber-800')}>
                {reasonOk
                  ? `Saved with the void and shown in the records CSV export. ${reason.length}/500 chars.`
                  : `At least 3 characters — bank readers rely on this to trust the audit. ${reason.length}/500 chars.`}
              </p>
            </div>
          </div>
        )}

        <footer className="flex flex-col gap-2 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/50 p-4 sm:flex-row-reverse sm:items-center sm:justify-start sm:p-5">
          {!alreadyVoided && (
            <Button
              size="sm"
              onClick={() => voidRow.mutate()}
              disabled={!canSubmit}
              className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-600/30"
            >
              {voidRow.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
              Void entry
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
