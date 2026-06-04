'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { endpoints } from '@/lib/api';
import { StepShell, LearnMoreDrawer, LearnMoreHeading } from './wizard-shell';

/**
 * Step 0 — pick the date the record belongs to.
 *
 * Maps directly to the mobile figma calendar:
 *
 *   - `today`        → dark green tile with white number
 *   - `has records`  → light-green tile (record_date already has rows)
 *   - `empty`        → white tile
 *   - `selected ≠ today` → black tile with white number
 *
 * Selecting today or an empty past day → wizard advances in ADD mode
 * (button reads "Add record"). Selecting a day that already has
 * records → wizard advances in EDIT mode (button reads "Edit record").
 *
 * Future days are disabled — you can't pre-record what hasn't
 * happened (matches the mobile flow).
 *
 * The calendar shows whichever month the user has navigated to via
 * the </> arrows. Per-month record-count data is fetched lazily as
 * they navigate; cached per (flockId, month) so re-visits are
 * instant.
 */
export function DatePickerStep({
  flockId,
  value,
  onChange,
  onCancel,
  onContinue,
  stepCount,
  hasRecordsOnSelectedDate,
}: {
  flockId: string;
  /** Selected date, YYYY-MM-DD. Always present — initialised to today. */
  value: string;
  onChange: (date: string) => void;
  onCancel: () => void;
  onContinue: () => void;
  /** Total step count — used by the section pill ("Date · Step 0 of 7"). */
  stepCount: number;
  /** Whether the selected date already has records (drives the CTA copy). */
  hasRecordsOnSelectedDate: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Anchor for the currently-visible month. Defaults to the selected
  // date's month so the user sees their selection on first render.
  const [monthAnchor, setMonthAnchor] = useState(() => firstOfMonth(value));

  const monthKey = ymOf(monthAnchor);

  const calendar = useQuery({
    queryKey: ['daily-record-calendar', flockId, monthKey],
    queryFn: () => endpoints.getDailyRecordCalendar(flockId, monthKey),
    staleTime: 30_000,
  });

  const recordedDates = useMemo(() => {
    const set = new Set<string>();
    for (const d of calendar.data?.days ?? []) set.add(d.date);
    return set;
  }, [calendar.data]);

  const cells = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);

  const today = todayYmd();
  const isFuture = (d: string) => d > today;
  const selectedDay = parseYmd(value);

  /* ------------------------------------------------------------------ */
  /*  Header strip — "Today: August 20, 2025" or "Monday: August 18"    */
  /* ------------------------------------------------------------------ */

  const headerText = useMemo(() => {
    const d = parseYmd(value);
    if (value === today) return `Today: ${formatLong(d)}`;
    return `${formatWeekday(d)}: ${formatLong(d)}`;
  }, [value, today]);

  /* ------------------------------------------------------------------ */
  /*  Month navigation                                                  */
  /* ------------------------------------------------------------------ */

  const monthLabel = formatMonthYear(monthAnchor);
  const prevMonth = () => setMonthAnchor(addMonths(monthAnchor, -1));
  const nextMonth = () => setMonthAnchor(addMonths(monthAnchor, 1));

  return (
    <>
      <StepShell
        sectionIcon={<Calendar className="h-3.5 w-3.5" />}
        sectionLabel="Select date"
        stepIndex={0}
        stepCount={stepCount}
        onCancel={onCancel}
        onLearnMore={() => setDrawerOpen(true)}
        onContinue={onContinue}
        continueLabel={hasRecordsOnSelectedDate ? 'Edit record' : 'Add record'}
      >
        {/* Date header strip */}
        <div className="mb-4 rounded-xl border border-[var(--color-brand-border)] bg-white px-4 py-3 text-center">
          <p className="text-[13.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {headerText}
          </p>
        </div>

        {/* Calendar card */}
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white px-3 py-4">
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-[13.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="mb-1 grid grid-cols-7 gap-1 px-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <p key={d} className="text-center text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
                {d}
              </p>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const date = cell.date;
              const isToday = date === today;
              const isSelected = date === value;
              const inMonth = cell.inMonth;
              const future = isFuture(date);
              const hasRecords = recordedDates.has(date);

              // Tile state machine (mirrors the figma):
              //   future       → muted, non-clickable
              //   selected & today      → dark green (always today's marker wins)
              //   selected & ≠ today    → black square
              //   not selected, today   → outlined green (today indicator)
              //   not selected, hasRecs → light-green fill
              //   else                  → white
              let cls = 'h-10 rounded-md text-[12.5px] font-semibold transition-colors';
              if (future) {
                cls += ' cursor-not-allowed text-[var(--color-brand-muted-soft)]';
              } else if (!inMonth) {
                cls += ' text-[var(--color-brand-muted-soft)] hover:bg-[var(--color-brand-surface-soft)]';
              } else if (isSelected && isToday) {
                cls += ' bg-[var(--color-brand-primary)] text-white';
              } else if (isSelected) {
                cls += ' bg-[var(--color-brand-fg)] text-white';
              } else if (isToday) {
                cls += ' bg-white text-[var(--color-brand-fg)] ring-2 ring-[var(--color-brand-primary)]';
              } else if (hasRecords) {
                cls += ' bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-accent)]';
              } else {
                cls += ' bg-white text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-surface-soft)]';
              }

              return (
                <button
                  type="button"
                  key={date}
                  disabled={future}
                  onClick={() => !future && onChange(date)}
                  className={cls}
                  aria-label={date}
                  aria-pressed={isSelected}
                >
                  {selectedDay && cell.day}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10.5px] text-[var(--color-brand-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-brand-primary)]" />
              Today
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-brand-accent)]/70 ring-1 ring-[var(--color-brand-border)]" />
              Has records
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-white ring-1 ring-[var(--color-brand-border)]" />
              Empty
            </span>
          </div>
        </div>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Select date"
      >
        <LearnMoreHeading>Today by default</LearnMoreHeading>
        <p>
          The wizard opens on today&rsquo;s date so the fastest path is to just tap
          <strong> Add record</strong>. You can back-fill yesterday or any earlier
          day by tapping it in the calendar.
        </p>
        <LearnMoreHeading>What the colours mean</LearnMoreHeading>
        <p>
          <strong>Green ring</strong> is today. <strong>Light green fill</strong> means
          you&rsquo;ve already logged at least one record on that day &mdash; tapping it
          opens the wizard in <em>edit</em> mode so you can correct what you entered
          rather than duplicate it. <strong>White</strong> means the day is empty.
        </p>
        <LearnMoreHeading>Future dates</LearnMoreHeading>
        <p>
          You can&rsquo;t pre-record what hasn&rsquo;t happened. Future days are greyed out
          until the calendar rolls over.
        </p>
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Date helpers                                                       */
/* ================================================================== */

/** Today as YYYY-MM-DD in the local timezone. */
function todayYmd(): string {
  return ymdOf(new Date());
}

function ymdOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function firstOfMonth(ymd: string): Date {
  const d = parseYmd(ymd);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatLong(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Build the 6x7 grid of cells for a month. Mirrors the figma's
 * Monday-first layout. Includes trailing cells from the previous /
 * next month to fill the grid, which we render muted.
 */
function buildMonthGrid(anchor: Date): Array<{ date: string; day: number; inMonth: boolean }> {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Mon=0…Sun=6 (figma layout). JS getDay: Sun=0…Sat=6.
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      date: ymdOf(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}
