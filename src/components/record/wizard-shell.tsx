'use client';

import Link from 'next/link';
import {
  ArrowLeft, X, ChevronRight, Info, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StepShell — the chrome every step of the Add-record wizard shares.
 *
 * Mirrors the mobile figma exactly:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  ‹  Add record               Cancel ✕   │  ← header
 *   ├─────────────────────────────────────────┤
 *   │  🟢 Feed consumption ⓘ Learn more · Step 1 of 6 │  ← section pill
 *   ├─────────────────────────────────────────┤
 *   │                                         │
 *   │            (form content)               │  ← scrollable body
 *   │                                         │
 *   │                                         │
 *   │            Skip this step               │
 *   ├─────────────────────────────────────────┤
 *   │      ┌─────────────────────────────┐    │
 *   │      │  Continue                 › │    │  ← sticky CTA
 *   │      └─────────────────────────────┘    │
 *   └─────────────────────────────────────────┘
 *
 * Sub-pages compose the body and pass everything else as props. The
 * sticky CTA stays above the keyboard on mobile (position: fixed with
 * env(safe-area-inset-bottom)).
 */
export function StepShell({
  sectionIcon,
  sectionLabel,
  sectionTint = 'green',
  stepIndex,
  stepCount,
  onCancel,
  onBack,
  onLearnMore,
  onSkip,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  continuePending,
  children,
}: {
  sectionIcon: React.ReactNode;
  sectionLabel: string;
  /** Tint of the section pill — green by default, red for warnings. */
  sectionTint?: 'green' | 'amber' | 'rose';
  stepIndex: number;        // 1-based
  stepCount: number;
  /** Header "Cancel ✕" — usually navigates out of the wizard. */
  onCancel: () => void;
  /** Header "‹" back arrow — absent on the first step. */
  onBack?: () => void;
  /** Opens the LearnMoreDrawer. Required — every step has a help blurb. */
  onLearnMore?: () => void;
  /** "Skip this step" footer link — absent when the step is required. */
  onSkip?: () => void;
  /** Sticky Continue button handler. */
  onContinue: () => void;
  /** Button text — usually Continue, Complete record on last step, Save when editing. */
  continueLabel?: string;
  continueDisabled?: boolean;
  continuePending?: boolean;
  children: React.ReactNode;
}) {
  const pillTone = {
    green: 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
    amber: 'bg-amber-50 text-amber-800',
    rose:  'bg-rose-50 text-rose-700',
  }[sectionTint];

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[640px] flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-brand-border)] bg-white px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span aria-hidden className="h-9 w-9" />
        )}
        <p className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          Add record
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
        >
          Cancel
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Section pill */}
      <div className="border-b border-[var(--color-brand-border)] bg-white px-4 py-2.5">
        <div className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2', pillTone)}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0">{sectionIcon}</span>
            <p className="truncate text-[13px] font-bold tracking-tight">{sectionLabel}</p>
            {onLearnMore && (
              <button
                type="button"
                onClick={onLearnMore}
                className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold underline-offset-2 hover:underline"
              >
                <Info className="h-3 w-3" />
                Learn more
              </button>
            )}
          </div>
          <p className="shrink-0 text-[11px] font-bold uppercase tracking-wider">
            Step {stepIndex} of {stepCount}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-5 pb-28">
        {children}
        {onSkip && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onSkip}
              className="text-[12.5px] font-semibold text-[var(--color-brand-muted)] underline-offset-4 hover:text-[var(--color-brand-fg)] hover:underline"
            >
              Skip this step
            </button>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div
        className="sticky bottom-0 z-10 border-t border-[var(--color-brand-border)] bg-white px-4 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.75rem)' }}
      >
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled || continuePending}
          className={cn(
            'group flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-bold tracking-tight transition-all',
            continueDisabled
              ? 'cursor-not-allowed bg-[var(--color-brand-primary)]/40 text-white/80'
              : 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-deep)]',
          )}
        >
          {continuePending && <Loader2 className="h-4 w-4 animate-spin" />}
          {continueLabel}
          {!continuePending && <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  YesNoPills                                                         */
/* ================================================================== */

/**
 * The big green/grey Yes/No row from the figma. Default value is
 * controlled by the caller; "primary" prop picks which side is the
 * accelerator default (green when nothing is selected).
 */
export function YesNoPills({
  value, onChange, primary = 'no',
}: {
  value: 'yes' | 'no' | null;
  onChange: (v: 'yes' | 'no') => void;
  /** Which side starts highlighted before user picks. */
  primary?: 'yes' | 'no';
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['yes', 'no'] as const).map((opt) => {
        const active = value === opt || (value === null && opt === primary);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'h-12 rounded-lg text-[14px] font-bold capitalize transition-colors',
              active
                ? 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-deep)]'
                : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-border)]',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  NumberKeypadInput — big numeric field                              */
/* ================================================================== */

/**
 * The "Feed amount / 40 [kg]" style row from the figma. Big numeric
 * input on the left, optional unit dropdown/label on the right, leaf
 * icon prefix. inputMode="decimal" surfaces the numeric keyboard on
 * mobile. Caller owns the value+units.
 */
export function NumberKeypadInput({
  id,
  label,
  description,
  value,
  onChange,
  unit,
  onUnitChange,
  unitOptions,
  placeholder = '0',
  prefix,
}: {
  id?: string;
  label?: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  onUnitChange?: (u: string) => void;
  unitOptions?: string[];
  placeholder?: string;
  /** Leaf / drop icon shown inside the input on the left. */
  prefix?: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor={id} className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {label}
          </label>
          {description && (
            <span className="text-[11px] text-[var(--color-brand-muted)]">{description}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3 py-2.5 focus-within:border-[var(--color-brand-primary)]">
        {prefix && (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(sanitiseNumeric(e.target.value))}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-muted-soft)]"
        />
        {unitOptions && onUnitChange ? (
          <select
            value={unit ?? unitOptions[0]}
            onChange={(e) => onUnitChange(e.target.value)}
            className="cursor-pointer rounded-md border-0 bg-[var(--color-brand-surface-soft)] py-1 pl-2 pr-7 text-[12.5px] font-semibold text-[var(--color-brand-fg)] focus:outline-none"
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        ) : unit ? (
          <span className="shrink-0 text-[12.5px] font-semibold text-[var(--color-brand-muted)]">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Allow digits + at most one decimal separator. Strips anything else.
 * Caller treats empty string as "no value entered yet" rather than 0.
 */
function sanitiseNumeric(raw: string): string {
  // Replace comma with dot for European keyboards, keep digits and dots.
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  // Allow at most one dot.
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

/* ================================================================== */
/*  BeigeAlert + AnomalyWarning                                        */
/* ================================================================== */

/**
 * The light beige info banner from the figma (e.g. "According to the
 * vaccination record your flock should receive vaccine X today").
 * Used for non-blocking guidance.
 */
export function BeigeAlert({
  title, children,
}: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
      {title && (
        <p className="mb-0.5 text-[12px] font-bold text-amber-900">{title}</p>
      )}
      <p className="text-[12px] leading-snug text-amber-900">{children}</p>
    </div>
  );
}

/**
 * The red "Are you sure? You have entered for [more] feed than usual"
 * line from the figma. Sits inline with form inputs as a soft
 * anomaly warning — never blocks submit.
 */
export function AnomalyWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--color-brand-danger)]">
      <strong className="font-bold">Are you sure?</strong> {children}
    </p>
  );
}

/* ================================================================== */
/*  LearnMoreDrawer                                                    */
/* ================================================================== */

/**
 * The bottom-sheet help drawer triggered by the "Learn more" link in
 * the section pill. Shows the longer-form explainer from the figma
 * (those green-headed cards with "Keeping record of feed", "Feed
 * type", "Feed brand", etc).
 *
 * Caller passes the content as children so each step can compose its
 * own.
 */
export function LearnMoreDrawer({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div aria-hidden className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.30)] sm:max-w-[520px] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-5 py-4">
          <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 text-[13px] leading-relaxed text-[var(--color-brand-fg)]">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Sub-heading inside a LearnMoreDrawer — matches the green-bold
 * headings in the figma's help drawer.
 */
export function LearnMoreHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary)]">
      {children}
    </h3>
  );
}

/* ================================================================== */
/*  Re-export Link so step components don't import twice               */
/* ================================================================== */
export { Link };
