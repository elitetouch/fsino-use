'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Lock } from 'lucide-react';
import type { DailyRecordDto } from '@/lib/api';
import { readUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

/* ================================================================== */
/*  useEntryChoice — picker / form state machine for each step          */
/* ================================================================== */

/**
 * Three-state machine driving each step's ADD / EDIT-this-one / PICK
 * branches.
 *
 *   `existingList.length === 0`  →  start in 'add'
 *   `existingList.length === 1`  →  start with that one as 'edit'
 *   `existingList.length >= 2`   →  start in 'picking'
 *
 * The returned `formKey` is meant for the form sub-component's React
 * key — each transition (picking → editing record A → switching to
 * record B → switching to add-new) bumps the key, forcing a remount
 * so the form's lazy useState initialisers re-run against the new
 * `existing` value. Without this, the form would render with whichever
 * `existing` it saw on its first mount and never update.
 */
export type EntryChoice =
  | { kind: 'add' }
  | { kind: 'edit', record: DailyRecordDto }
  | { kind: 'picking' };

export interface EntryChoiceApi {
  /** Render the EntryPicker in this state. */
  showPicker: boolean;
  /** The record being edited, or undefined for ADD mode / picking. */
  existing: DailyRecordDto | undefined;
  /** Stable key per choice — bump remounts the form sub-component. */
  formKey: string;
  /** Picker → editing transition. */
  pickRecord: (r: DailyRecordDto) => void;
  /** Picker → adding-fresh transition. */
  pickAddNew: () => void;
  /** Editing/adding → back to picker (only meaningful when existingList.length >= 2). */
  goToPicker: () => void;
}

export function useEntryChoice(existingList: DailyRecordDto[]): EntryChoiceApi {
  const [choice, setChoice] = useState<EntryChoice>(() => {
    if (existingList.length === 0) return { kind: 'add' };
    if (existingList.length === 1) return { kind: 'edit', record: existingList[0]! };
    return { kind: 'picking' };
  });

  return {
    showPicker: choice.kind === 'picking',
    existing: choice.kind === 'edit' ? choice.record : undefined,
    formKey: choice.kind === 'edit' ? `edit-${choice.record.id}`
      : choice.kind === 'add' ? 'add-new'
      : 'picking',
    pickRecord: (r) => setChoice({ kind: 'edit', record: r }),
    pickAddNew: () => setChoice({ kind: 'add' }),
    goToPicker: () => setChoice({ kind: 'picking' }),
  };
}

/**
 * EntryPicker — choose which of today's existing entries to edit,
 * or opt to add a brand-new one instead.
 *
 * Surfaces ONLY when a step's edit-target date has 2+ records of the
 * same event_type (e.g. four feed rows logged across a single day by
 * multiple staff). The single-record case bypasses this and pre-fills
 * the form directly; the zero-record case is ADD mode.
 *
 * Why this exists (the principle worth reading once):
 *   Records are append-only with selective edits. Multiple staff
 *   logging multiple entries per day is the NORMAL case in a real
 *   poultry operation. Silently overwriting whichever entry happens
 *   to be "most recent" is a data-integrity bug — it shifts the
 *   dashboard's daily aggregate in a way the user didn't intend
 *   and erases somebody else's contribution.
 *
 * UX rules baked in:
 *   - "Add another" is rendered as visually-equal to picking an entry,
 *     not as a hidden afterthought. For ~90% of real-world corrections
 *     ("I forgot the 18 kg top-up at 3 PM") the right answer is logging
 *     a new entry, not patching someone else's.
 *   - Day total + entry count is shown at the bottom so the user is
 *     anchored to "this is a slice of N entries", not "this is the day".
 *   - Staff users can only edit records they themselves created (the
 *     backend's UpdateFlockDailyRecord ownership check). The picker
 *     reflects this: foreign rows get a lock icon + disabled select,
 *     but "Add another" is always enabled.
 *
 * Caller contract:
 *   - `entries`     — all matching records for the step's event_type.
 *   - `onSelect(record)`     — user picked an existing row to edit.
 *   - `onAddAnother()`       — user wants to log a fresh entry.
 *   - `summary(record)`      — short string describing the record
 *                              (caller knows the shape best — feed
 *                              renders quantity+unit+brand, vaccination
 *                              renders the vaccine name, etc.)
 *   - `totalLine(entries)`   — optional aggregate line ("Today total:
 *                              75 kg across 4 entries"). Pure render.
 */
export function EntryPicker({
  eventLabel,
  entries,
  onSelect,
  onAddAnother,
  summary,
  totalLine,
}: {
  /** "feed entry" / "water entry" / "vaccination" — pluralised on the heading. */
  eventLabel: string;
  entries: DailyRecordDto[];
  onSelect: (record: DailyRecordDto) => void;
  onAddAnother: () => void;
  summary: (record: DailyRecordDto) => string;
  totalLine?: string;
}) {
  const user = readUser();
  const currentUserId = user?.id ?? null;

  // Sorted oldest-first for chronological reading — matches the
  // mental picture "morning → midday → afternoon → evening".
  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.occurredAt ?? '').localeCompare(b.occurredAt ?? '')),
    [entries],
  );

  const [highlighted, setHighlighted] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
        <header className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            Multiple entries today
          </p>
          <p className="mt-0.5 text-[13px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Today already has {entries.length} {eventLabel}{entries.length === 1 ? '' : 's'}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">
            Tap an entry to edit it, or add a new one. Picking an entry only
            changes that one row &mdash; the others stay untouched.
          </p>
        </header>

        <ul className="divide-y divide-[var(--color-brand-border)]">
          {sorted.map((rec) => {
            const author = rec.createdByUser?.name ?? 'Unknown';
            const authorId = rec.createdByUser?.id ?? null;
            const isOwn = authorId !== null && currentUserId !== null && String(authorId) === String(currentUserId);
            // Backend enforces "staff may only edit records they
            // themselves created". Owner/manager bypass — we can't
            // tell role here without another query, so we let the
            // server be the source of truth and surface a lock icon
            // purely as a hint for the common staff case.
            // (If a staff user clicks a foreign row anyway, the
            // PATCH will 403 with a clear error — no data loss.)
            const isHighlighted = highlighted === rec.id;
            return (
              <li key={rec.id}>
                <button
                  type="button"
                  onClick={() => {
                    setHighlighted(rec.id);
                    onSelect(rec);
                  }}
                  className={cn(
                    'group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                    isHighlighted
                      ? 'bg-[var(--color-brand-accent)]/55'
                      : 'hover:bg-[var(--color-brand-surface-soft)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isHighlighted
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white'
                        : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-muted-soft)] group-hover:border-[var(--color-brand-primary)]/40',
                    )}
                  >
                    {isHighlighted && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                        {fmtClock(rec.occurredAt)}
                      </p>
                      <p className="text-[11.5px] text-[var(--color-brand-muted)]">
                        · {author}{isOwn ? ' (you)' : ''}
                      </p>
                      {!isOwn && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-brand-surface-soft)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[var(--color-brand-muted-soft)]"
                          title="Staff users can only edit records they created themselves. Tap to try anyway — the server will return a clear message if it's not allowed."
                        >
                          <Lock className="h-2.5 w-2.5" />
                          Theirs
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--color-brand-fg-soft)]">
                      {summary(rec)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {totalLine && (
          <footer className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-2.5">
            <p className="text-[11.5px] font-semibold tracking-tight text-[var(--color-brand-fg-soft)]">
              {totalLine}
            </p>
          </footer>
        )}
      </div>

      {/* Add-another row — visually equal to the entries above so it
          doesn't feel like a secondary action. For most real-world
          corrections, this IS the right answer. */}
      <button
        type="button"
        onClick={onAddAnother}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-brand-primary)]/40 bg-white px-4 py-3 text-[13px] font-bold tracking-tight text-[var(--color-brand-primary-deep)] transition-colors hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)]/40"
      >
        <Plus className="h-4 w-4" />
        Add another {eventLabel}
      </button>
    </div>
  );
}

/** "7:00 AM" / "11:45 PM" — short clock display for the chosen time. */
function fmtClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
