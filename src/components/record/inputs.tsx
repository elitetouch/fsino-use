'use client';

import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ================================================================== */
/*  Shared focus classes                                               */
/* ================================================================== */

/**
 * Common focus state for any wrapped-input row (a container holding a
 * text input + icon prefix + unit suffix). Subtle border colour change
 * + 2px soft tint ring, matching the focus pattern in the existing
 * `Input` component (components/ui/input.tsx). No hard 2px outline —
 * the global :focus-visible rule already excludes form elements
 * (see globals.css) so this is the only focus indicator in play.
 */
export const FOCUS_WRAPPER =
  'transition focus-within:border-[var(--color-brand-primary)] focus-within:ring-2 focus-within:ring-[var(--color-brand-primary)]/15';

/**
 * Same shape for a bare input that doesn't sit inside a wrapper (the
 * "Other (type in)" free-text fallbacks scattered across the step
 * files). Wrap-level focus-within → input-level focus.
 */
export const FOCUS_INPUT =
  'transition focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/15';

/* ================================================================== */
/*  PillTiles — Starter / Grower / Finisher etc.                       */
/* ================================================================== */

/**
 * Segmented pill row from the figma — used for feed type (Starter /
 * Grower / Finisher), moments (Morning / Evening / Entire day) and any
 * other small set of mutually-exclusive choices.
 *
 * Selected tile is fully-saturated brand-primary; the others are
 * outlined white. Caller owns the state.
 */
export function PillTiles<T extends string>({
  value, onChange, options, disabled,
}: {
  value: T | null;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        // Auto-fit columns to count — 2 across on phones, full row on sm.
        options.length === 2 && 'grid-cols-2',
        options.length === 3 && 'grid-cols-3',
        options.length >= 4 && 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={String(opt.value)}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-11 rounded-lg border text-[13px] font-bold tracking-tight transition-colors',
              active
                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-deep)]'
                : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-fg)] hover:border-[var(--color-brand-primary)]/40',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Dropdown — styled <select> wrapper                                 */
/* ================================================================== */

/**
 * Native <select> styled to match the figma's "Select brand /
 * Select moment / Select vaccine" dropdowns. Native picker is the
 * right call here — every mobile browser renders a polished system
 * picker that handles long lists, scrolling and accessibility for
 * free. We just style the trigger.
 */
export function Dropdown<T extends string>({
  id,
  label,
  hint,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
}: {
  id?: string;
  label?: string;
  hint?: string;
  value: T | '';
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor={id} className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {label}
          </label>
          {hint && <span className="text-[11px] text-[var(--color-brand-muted)]">{hint}</span>}
        </div>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          className={cn(
            'h-11 w-full appearance-none rounded-lg border border-[var(--color-brand-input-border)] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[var(--color-brand-fg)]',
            FOCUS_INPUT,
            value === '' && 'text-[var(--color-brand-muted-soft)] font-normal',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <option value="" disabled hidden>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-muted)]" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  ScheduleAlert — schedule-aware beige messages                      */
/* ================================================================== */

/**
 * Used by the bird-weight step's "Last weighing X days ago" header
 * banner, plus any other step that wants a small beige info card
 * above the form. Distinct from BeigeAlert (in wizard-shell.tsx) only
 * by having an optional title/eyebrow.
 */
export function ScheduleAlert({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
      {eyebrow && (
        <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-700">
          {eyebrow}
        </p>
      )}
      <p className="text-[12.5px] leading-snug text-amber-900">{children}</p>
    </div>
  );
}

/* ================================================================== */
/*  FieldStack — vertical group with consistent spacing                */
/* ================================================================== */

/**
 * Vertical rhythm for stacked inputs in a step body. Every step uses
 * this so spacing stays consistent.
 */
export function FieldStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

/* ================================================================== */
/*  CheckmarkPill — subtle "completed" badge                           */
/* ================================================================== */

/**
 * Small green chip used after a successful save to confirm "Logged
 * for Pen B" before advancing. Not in every step — just a polish for
 * those that want it.
 */
export function CheckmarkPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-accent)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
      <Check className="h-3 w-3" strokeWidth={3} />
      {children}
    </span>
  );
}
