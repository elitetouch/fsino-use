'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpFromLine, CheckCircle2, Clock, CloudOff, Loader2, RotateCw, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { useOutbox } from '@/lib/offline/hooks';
import { discard, retry } from '@/lib/offline/queue';
import { drain } from '@/lib/offline/sync';
import type { OutboxEntry, OutboxStatus } from '@/lib/offline/db';

/**
 * Changes saved on this device that have not reached the server.
 *
 * WHY THIS PAGE EXISTS
 * --------------------
 * The offline banner has always had a "Review" button pointing at
 * /sync, and /sync was never built — so the one moment a farmer was most
 * likely to tap it, when their records were stuck, sent them to a 404.
 *
 * WHAT IT HAS TO GET RIGHT
 * ------------------------
 * The entries here are a farmer's own work: a morning's mortality count,
 * a feed entry, a vaccination. Some are hours old. The page has two
 * jobs, and the second matters more than the first:
 *
 *   1. Say plainly what is stuck and why.
 *   2. Never lose a record by accident.
 *
 * Which is why discarding is a two-step confirmation naming what is
 * about to be thrown away, and why nothing here is bulk-discardable.
 * Retrying everything is one tap because it is safe; throwing work away
 * is deliberately not.
 *
 * WRITTEN FOR SOMEONE WHO DOES NOT KNOW WHAT A QUEUE IS. No "outbox",
 * no "409", no HTTP verbs. A farmer knows what "Mortality for Pen 2" is.
 */

/**
 * What each queue state means, in the farmer's terms.
 *
 * `in-flight` is deliberately absent: it lasts milliseconds and a row
 * that flickers through a state nobody can read is noise. It falls back
 * to the pending copy.
 */
const STATES: Record<
  Exclude<OutboxStatus, 'in-flight'>,
  { label: string; blurb: string; tone: 'wait' | 'warn' | 'stop'; icon: typeof Clock }
> = {
  pending: {
    label: 'Waiting',
    blurb: 'Will send by itself once you have a connection.',
    tone: 'wait',
    icon: Clock,
  },
  parked: {
    label: 'Gave up retrying',
    blurb: 'Tried several times and could not get through. Try again when your signal is better.',
    tone: 'warn',
    icon: RotateCw,
  },
  conflict: {
    label: 'Changed elsewhere',
    blurb:
      'Someone else on your farm changed this record while you were offline. Sending yours would overwrite theirs.',
    tone: 'stop',
    icon: AlertTriangle,
  },
  'failed-permanent': {
    label: 'Rejected',
    blurb: 'The server would not accept this one. Retrying will not help on its own.',
    tone: 'stop',
    icon: AlertTriangle,
  },
};

const TONE: Record<'wait' | 'warn' | 'stop', string> = {
  wait: 'text-[var(--color-brand-muted)] bg-[var(--color-brand-surface-soft)]',
  warn: 'text-[var(--color-brand-warning)] bg-[var(--color-brand-warning)]/10',
  stop: 'text-[var(--color-brand-danger)] bg-[var(--color-brand-danger)]/10',
};

export default function SyncPage() {
  const { entries, refresh } = useOutbox();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Needs-attention first, then oldest first. Someone opening this page
  // came to fix something, and within a band the oldest record is the
  // one that has been missing from their books longest.
  const sorted = useMemo(() => {
    const rank: Record<string, number> = {
      conflict: 0,
      'failed-permanent': 1,
      parked: 2,
      pending: 3,
      'in-flight': 3,
    };
    return [...entries].sort(
      (a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.enqueuedAt - b.enqueuedAt,
    );
  }, [entries]);

  const stuck = sorted.filter((e) => e.status !== 'pending' && e.status !== 'in-flight').length;

  const sendAll = async () => {
    setBusy('all');
    try {
      const sent = await drain();
      toast.success(
        sent > 0
          ? `${sent} ${sent === 1 ? 'change' : 'changes'} sent.`
          : 'Nothing sent — check your connection.',
      );
    } catch {
      toast.error("Couldn't reach the server. Try again when you have signal.");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const retryOne = async (entry: OutboxEntry) => {
    setBusy(entry.key);
    try {
      await retry(entry.key);
      await drain();
      toast.success('Sent.');
    } catch {
      toast.error('Still could not send it.');
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const discardOne = async (entry: OutboxEntry) => {
    setBusy(entry.key);
    try {
      await discard(entry.key);
      toast.success('Removed from this device.');
    } catch {
      toast.error("Couldn't remove it.");
    } finally {
      setBusy(null);
      setConfirming(null);
      refresh();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[46rem] space-y-5 pb-8">
      <PageHeader
        eyebrow="Offline"
        title="Unsent changes"
        description="Records saved on this phone that have not reached the server yet."
        actions={
          entries.length > 0 ? (
            <Button size="sm" onClick={sendAll} disabled={busy !== null}>
              {busy === 'all' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-3.5 w-3.5" />
              )}
              Try sending all
            </Button>
          ) : null
        }
      />

      {entries.length === 0 ? (
        // THE STATE MOST PEOPLE SHOULD SEE. Worth saying clearly rather
        // than leaving an empty page that reads as something failing to
        // load — this screen is reached when someone is already worried
        // about their records.
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-8 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[0.9375rem] font-bold text-[var(--color-brand-fg)]">
            Everything is saved
          </p>
          <p className="mx-auto mt-1 max-w-[28rem] text-[0.8125rem] leading-relaxed text-[var(--color-brand-muted)]">
            Every record on this phone has reached the server. You can keep working offline —
            anything you enter will appear here until it sends.
          </p>
        </div>
      ) : (
        <>
          {stuck > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/[0.06] p-3.5">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-danger)]" />
              <p className="text-[0.8125rem] leading-relaxed text-[var(--color-brand-fg)]">
                <strong>
                  {stuck} {stuck === 1 ? 'change needs' : 'changes need'} your attention.
                </strong>{' '}
                They are safe on this phone, but they are not in your reports and nobody else on
                your farm can see them.
              </p>
            </div>
          )}

          <ul className="space-y-2.5">
            {sorted.map((entry) => (
              <Row
                key={entry.key}
                entry={entry}
                busy={busy === entry.key}
                disabled={busy !== null}
                confirming={confirming === entry.key}
                onRetry={() => retryOne(entry)}
                onAskDiscard={() => setConfirming(entry.key)}
                onCancelDiscard={() => setConfirming(null)}
                onDiscard={() => discardOne(entry)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Row({
  entry,
  busy,
  disabled,
  confirming,
  onRetry,
  onAskDiscard,
  onCancelDiscard,
  onDiscard,
}: {
  entry: OutboxEntry;
  busy: boolean;
  disabled: boolean;
  confirming: boolean;
  onRetry: () => void;
  onAskDiscard: () => void;
  onCancelDiscard: () => void;
  onDiscard: () => void;
}) {
  const state = STATES[entry.status as Exclude<OutboxStatus, 'in-flight'>] ?? STATES.pending;
  const Icon = state.icon;

  return (
    <li className="rounded-xl border border-[var(--color-brand-border)] bg-white p-3.5">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[state.tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold text-[var(--color-brand-fg)]">
            {describe(entry)}
          </p>
          <p className="mt-0.5 text-[0.71875rem] text-[var(--color-brand-muted)]">
            {state.label} · saved {when(entry.enqueuedAt)}
            {entry.attempts > 0 && ` · tried ${entry.attempts}×`}
          </p>
          <p className="mt-1.5 text-[0.78125rem] leading-relaxed text-[var(--color-brand-muted)]">
            {state.blurb}
          </p>
        </div>
      </div>

      {confirming ? (
        // TWO STEPS TO THROW AWAY A FARMER'S WORK, and the confirmation
        // names the record rather than asking "are you sure?" — the
        // point is that they read what is about to be lost.
        <div className="mt-3 rounded-lg border border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/[0.06] p-3">
          <p className="text-[0.78125rem] leading-relaxed text-[var(--color-brand-fg)]">
            Delete <strong>{describe(entry)}</strong> from this phone? It was never saved to the
            server, so it cannot be recovered — you would need to enter it again.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={onCancelDiscard}>
              Keep it
            </Button>
            <Button
              size="sm"
              className="flex-1 !bg-[var(--color-brand-danger)] hover:!bg-[var(--color-brand-danger)]/90"
              onClick={onDiscard}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete it
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onRetry}
            disabled={disabled}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
            Try again
          </Button>
          <button
            type="button"
            onClick={onAskDiscard}
            disabled={disabled}
            className="rounded-lg px-3 text-[0.78125rem] font-semibold text-[var(--color-brand-muted)] underline underline-offset-2 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Name the record in the farmer's language.
 *
 * Derived from the request URL, because that is all the queue stores —
 * it is transport-level by design and does not know what a "mortality
 * entry" is. Reading it here keeps that separation while still putting
 * something recognisable on screen. An unmatched URL falls back to
 * "A saved change", which is vague but never wrong; guessing would be
 * worse, since this text decides whether someone deletes it.
 */
function describe(entry: OutboxEntry): string {
  const url = entry.url;

  if (url.includes('/records')) return 'Daily record';
  if (url.includes('/diagnoses')) return 'Disease check';
  if (url.includes('/expenses')) return 'Expense';
  if (url.includes('/sales')) return 'Sale';
  if (url.includes('/flocks') && entry.method === 'POST') return 'New flock';
  if (url.includes('/flocks')) return 'Flock update';
  if (url.includes('/pens') && entry.method === 'POST') return 'New pen';
  if (url.includes('/pens')) return 'Pen update';
  if (url.includes('/vaccination')) return 'Vaccination';
  if (url.includes('/profile')) return 'Profile change';
  if (url.includes('/settings')) return 'Settings change';

  return 'A saved change';
}

/** Relative time, in words, without pulling in a date library. */
function when(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
