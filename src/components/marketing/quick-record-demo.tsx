'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Check, AlertTriangle } from 'lucide-react';
import { parseQuickRecord } from '@/lib/quick-record/parse';
import { buildExpensePayloads } from '@/lib/quick-record/to-payloads';
import { moneyImpact } from '@/lib/quick-record/money-impact';
import type { ParsedField } from '@/lib/quick-record/parse';

/**
 * The quick-record demo on the landing page.
 *
 * IT RUNS THE REAL PARSER. The chips below are not a storyboard of
 * what the product does — they are `parseQuickRecord()` on the
 * sentence being typed, the same call the record screen makes. So the
 * demo cannot drift from the app: if a farmer's sentence stops
 * parsing, this breaks too and someone notices on the front page.
 *
 * A hand-written mock would have been less code and would have lied
 * the first time the vocabulary changed.
 *
 * On a phone on a Nigerian network this is also a thing that must not
 * cost anything: no images, no library, and the loop stops whenever
 * the section is off-screen or the tab is hidden. Motion is skipped
 * entirely for anyone who has asked for less of it — they get the
 * finished state, which is the part that makes the argument anyway.
 */

/** One example per thing a farmer does: lose birds, buy, sell. */
const SCRIPT: ReadonlyArray<{ text: string; currentBirds: number }> = [
  { text: '15 birds died and I gave them 2 bags of feed', currentBirds: 480 },
  { text: 'Bought 10 bags of feed for 45,000', currentBirds: 480 },
  { text: 'Sold 3 crates of eggs for 9,000', currentBirds: 480 },
];

const TYPE_MS = 45;

/**
 * How long the finished state stays on screen.
 *
 * Measured against what there is to read, not a round number. The
 * chips fade in over 600ms, and the money panel only appears once the
 * PRICE has been typed — which in "Sold 3 crates of eggs for 9,000"
 * is the last four characters. So the one line a visitor most needs
 * to see was the one on screen for the shortest time, and it read as
 * being cut off mid-thought.
 *
 * A sentence with money has a chip, an impact line and a total to
 * read, so it gets longer.
 */
const HOLD_MS = 4_200;
const HOLD_MONEY_BONUS_MS = 1_600;
const CLEAR_MS = 500;

const KIND_LABEL: Readonly<Record<string, string>> = {
  expense: 'Spent', produce_sale: 'Sold', dead: 'Died', culled: 'Culled',
  sold: 'Sold', lost: 'Lost', feed: 'Feed', water: 'Water', eggs: 'Eggs',
  weight: 'Weight', egg_weight: 'Egg weight', vaccination: 'Vaccine',
  treatment: 'Treatment',
};

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  birds: 'Birds', feed: 'Feed', vaccine: 'Vaccine', treatment: 'Treatment',
  fuel: 'Fuel', utilities: 'Utilities', repairs: 'Repairs', wages: 'Wages',
  equipment: 'Equipment', transport: 'Transport', other: 'Other',
};

function money(value: number): string {
  return `₦${value.toLocaleString('en-NG', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function chipText(f: ParsedField): string {
  const label = KIND_LABEL[f.kind] ?? f.kind;
  const isMoney = f.kind === 'expense' || f.kind === 'produce_sale';
  const value = isMoney ? money(f.value) : String(f.value);
  const detail =
    f.detail?.expenseCategory
      ? (CATEGORY_LABEL[f.detail.expenseCategory] ?? f.detail.expenseCategory)
      : f.detail?.produceLabel ?? f.detail?.feedType ?? null;
  const unit = f.unit && f.unit !== 'eggs' ? ` ${f.unit}` : '';
  return `${label}: ${value}${unit}${detail ? ` · ${detail}` : ''}`;
}

export function QuickRecordDemo() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [reduced, setReduced] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Someone who has asked for less motion gets the finished state.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Only animate while on screen and the tab is visible. A loop
  // running behind a scrolled-past section is battery a farmer is
  // paying for.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setRunning(Boolean(entry?.isIntersecting) && !document.hidden),
      { threshold: 0.25 },
    );
    io.observe(el);
    const onVisibility = () => setRunning((r) => r && !document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const target = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    if (reduced) {
      setTyped(target.text);
      return;
    }
    if (!running) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    setTyped('');
    for (let i = 1; i <= target.text.length; i += 1) {
      at(i * TYPE_MS, () => { if (!cancelled) setTyped(target.text.slice(0, i)); });
    }
    const typedFor = target.text.length * TYPE_MS;
    // Asked of the parser, not hard-coded per example, so adding a
    // sentence to SCRIPT cannot give it the wrong reading time.
    const showsMoney = parseQuickRecord(target.text).fields
      .some((f) => f.kind === 'expense' || f.kind === 'produce_sale');
    const hold = HOLD_MS + (showsMoney ? HOLD_MONEY_BONUS_MS : 0);

    at(typedFor + hold, () => { if (!cancelled) setTyped(''); });
    at(typedFor + hold + CLEAR_MS, () => { if (!cancelled) setStep((s) => s + 1); });

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [step, running, reduced, target.text]);

  // THE PRODUCT ITSELF, not a description of it.
  const parsed = useMemo(() => parseQuickRecord(typed), [typed]);
  const fields = parsed.fields;
  const impact = useMemo(
    () => moneyImpact(fields, { currentBirds: target.currentBirds }),
    [fields, target.currentBirds],
  );
  const expenses = useMemo(
    () => buildExpensePayloads(fields, { recordDate: '2026-01-01', currency: 'NGN' }),
    [fields],
  );

  const saveLabel =
    fields.length > 0
      ? `Save ${fields.length} ${fields.length === 1 ? 'entry' : 'entries'}`
      : 'Save record';

  return (
    <div ref={hostRef} className="mx-auto w-full max-w-[26rem]">
      <div className="rounded-2xl border-2 border-[var(--color-brand-input-border)] bg-white p-4 shadow-[0_24px_60px_-30px_rgba(15,80,30,0.45)]">
        <p className="flex items-center gap-2 text-[0.8125rem] font-bold text-[var(--color-brand-fg)]">
          <Mic className="h-4 w-4 text-[var(--color-brand-primary)]" aria-hidden />
          Say what happened today
        </p>

        {/*
          A div, not a textarea: nothing here is editable, and a focusable
          control in a decorative loop is a keyboard trap on a page that
          is meant to be read.
        */}
        <div
          aria-live="polite"
          className="mt-2 min-h-[4.5rem] rounded-xl border border-[var(--color-brand-input-border)] bg-[var(--color-brand-surface-soft)] px-3 py-2.5 text-[0.9375rem] leading-snug text-[var(--color-brand-fg)]"
        >
          {typed}
          {!reduced && (
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.18em] animate-pulse bg-[var(--color-brand-primary)]" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {fields.map((f, i) => (
            <span
              key={`${f.kind}-${i}`}
              className="animate-fade-in inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-accent)] px-2.5 py-1 text-[0.78125rem] font-semibold text-[var(--color-brand-primary-deep)]"
            >
              {f.confidence === 'low' && (
                <AlertTriangle className="h-3 w-3 text-amber-700" aria-hidden />
              )}
              {chipText(f)}
            </span>
          ))}
          {expenses.length > 0 && (
            <span className="animate-fade-in inline-flex items-center rounded-full bg-[var(--color-brand-fg)] px-2.5 py-1 text-[0.71875rem] font-bold text-white">
              Goes to your expenses
            </span>
          )}
        </div>

        {/* The part a transcription app cannot show. */}
        {impact && (
          <div className="animate-fade-in mt-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-3 py-2.5">
            <p className="text-[0.8125rem] font-bold text-[var(--color-brand-fg)]">
              {impact.out > 0 && impact.in > 0
                ? `${money(impact.out)} out, ${money(impact.in)} in`
                : impact.out > 0
                  ? `${money(impact.out)} out`
                  : `${money(impact.in)} in`}
              {impact.perBird !== null && (
                <span className="font-semibold text-[var(--color-brand-muted)]">
                  {' · about '}{money(impact.perBird)}{' a bird'}
                </span>
              )}
            </p>
          </div>
        )}

        <div className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] text-[0.875rem] font-bold text-white">
          <Check className="h-4 w-4" aria-hidden /> {saveLabel}
        </div>
      </div>

      <p className="mt-3 text-center text-[0.78125rem] text-[var(--color-brand-muted)]">
        This is the real thing — the same reader the app uses, running here.
      </p>
    </div>
  );
}
